import { HTMLParser } from 'html-minifier/src/htmlparser';
import detectIndent from 'detect-indent';
import Path from 'path';
import Url from 'url';
import Fs from 'pn/fs';

function stringRegExpEscape(string) {
	return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function argsToString([url, media, async]) {

	let str = `'${url}'`;

	if (async) {

		str += ', ';

		if (media) {
			str += `'${media}'`;
		} else {
			str += '0';
		}

		str += ', true';

	} else
	if (media) {
		str += `, '${media}'`;
	}

	return str;
}

function getImportCSS(async = false) {

	const scriptName = async
		? `link-in-body-async`
		: `link-in-body`;

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

function parse(markup) {

	const styles = [],
		scripts = [];

	let transformedMarkup = markup,
		async = false;

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
					if (priority == 'queued' || priority == 'async') {

						const isAsyncPriority = priority == 'async';

						if (isAsyncPriority) {
							async = isAsyncPriority;
						}

						scripts.push([href, media, isAsyncPriority]);
						transformedMarkup = transformedMarkup.replace(
							tagRegExp,
							''
						);
					}
				}
			}
		}
	});

	return {
		markup: transformedMarkup,
		styles,
		scripts,
		async
	};
}

export default function transform(markup, { base, noscript, preload }) {

	const indent = detectIndent(markup).indent || '  ',
		nl = `\n${indent}${indent}`,
		headPoint = /(\n\s*<\/head>)/,
		mountPoint = /(\n\s*<\/body>)/;

	const { markup: m, styles, scripts, async } = parse(markup);

	let transformedMarkup = m;

	return getImportCSS(async).then((importCSS) => {

		transformedMarkup = transformedMarkup.replace(
			mountPoint,
			`${nl}<script>${nl}${indent}${importCSS.trim()};${
				scripts.map(_ =>
					`${nl}${indent}importCSS(${argsToString(_)});`
				).join('')
			}${nl}</script>$1`
		);

		if (preload) {
			transformedMarkup = transformedMarkup.replace(
				headPoint,
				`${scripts.map(([href, media]) =>
					`${nl}<link rel="preload" as="style" href="${href}"${media ? ` media=${media}` : ''}>`
				).join('')}$1`
			);
		}

		if (noscript) {
			transformedMarkup = transformedMarkup.replace(
				headPoint,
				`${nl}<noscript>${
					scripts.map(([href, media]) =>
						`${nl}${indent}<link rel="stylesheet" href="${href}"${media ? ` media=${media}` : ''}>`
					).join('')
				}${nl}</noscript>$1`
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
