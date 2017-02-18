import { HTMLParser } from 'html-minifier/src/htmlparser';
import detectIndent from 'detect-indent';
import Path from 'path';
import Url from 'url';
import Fs from 'pn/fs';

function stringRegExpEscape(string) {
	return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function getImportCSS(useXHR = false) {

	const scriptName = useXHR
		? 'xhr'
		: 'link-and-body';

	const scriptPath = require.resolve(`import-css/lib/${scriptName}`);

	return Fs.readFile(scriptPath, 'utf8').then(script =>
		script
			.replace('\'use strict\';Object.defineProperty(exports,\'__esModule\',{value:!0}),exports.default', '!(function(w){\'use strict\';w.importCSS')
			.replace('module.exports=exports[\'default\'];', '})(window)')
	);
}

function getCriticalCSS(href, base = false) {

	const { pathname } = Url.parse(href),
		cssPath = base
			? Path.join(base, pathname)
			: pathname;

	return Fs.readFile(cssPath, 'utf8');
}

export default function transform(markup, base = './', useXHR = false) {

	const indent = detectIndent(markup).indent || '  ',
		styles = [],
		scripts = [];

	let transformedMarkup = markup,
		isFirstQueued = true;

	return getImportCSS(useXHR).then((importCSS) => {

		HTMLParser(markup, {
			html5: true,
			start(tag, attrs, unary, selfClosed) {

				if (tag == 'link') {

					let rel = false,
						priority = false,
						media = false,
						href = false;

					const tagRegExp = new RegExp(`(\\s*)<link ${attrs.map((attr) => {

						if (attr.name == 'rel') {
							rel = attr.value;
						}

						if (attr.name == 'priority') {
							priority = attr.value;
						}

						if (attr.name == 'media') {
							media = attr.value;
						}

						if (attr.name == 'href') {
							href = attr.value;
						}

						return `\\s*${stringRegExpEscape(attr.name)}\\s*=\\s*${attr.quote}${stringRegExpEscape(attr.value)}${attr.quote}`;

					}).join('')}\\s*${selfClosed}>`);

					if (rel == 'stylesheet' && typeof href == 'string') {

						if (priority == 'critical') {
							styles.push({
								tagRegExp,
								href
							});
						} else
						if (priority == 'queued') {

							if (useXHR) {
								transformedMarkup = transformedMarkup.replace(
									tagRegExp,
									`${isFirstQueued
										? `$1<script>${importCSS.trim()}</script>`
										: ''
									}$1<script>importCSS('${href}')</script>`
								);
							} else {
								scripts.push([href, media]);
								transformedMarkup = transformedMarkup.replace(
									tagRegExp,
									''
								);
							}

							isFirstQueued = false;
						}
					}
				}
			}
		});

		if (!useXHR) {
			transformedMarkup = transformedMarkup.replace(
				/(\n\s*<\/body>)/,
				`\n${indent}${indent}<script>${importCSS.trim()}</script>${
					scripts.map(_ =>
						`\n${indent}${indent}<script>importCSS('${_.filter(_ => _).join(`', '`)}')</script>`
					).join('')
				}$1`
			);
		}

		if (!styles.length) {
			return transformedMarkup;
		}

		return Promise.all(styles.map(({ tagRegExp, href }) =>
			getCriticalCSS(href, base).then((criticalCSS) => {
				transformedMarkup = transformedMarkup.replace(
					tagRegExp,
					`$1<style>${criticalCSS.trim()}</style>`
				);
			})
		)).then(() =>
			transformedMarkup
		);
	});
}
