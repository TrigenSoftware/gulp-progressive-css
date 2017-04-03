import { HTMLParser } from 'html-minifier/src/htmlparser';
import detectIndent from 'detect-indent';
import mkdirp from 'mkdirp';
import Path from 'path';
import Url from 'url';
import Fs from 'pn/fs';

const searchUrl = /url\((['"]?)(.+?)\1\)/g,
	urlExcludes = ['/', 'data:', 'http:', 'https:'];

function stylesNameFromHtmlFilename(htmlFilename) {
	return `${Path.basename(
		htmlFilename,
		Path.extname(htmlFilename)
	)}-styles.css`;
}

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

function mkdir(dir) {
	return new Promise((resolve, reject) => {
		mkdirp(dir, (err) => {

			if (err) {
				reject(err);
				return;
			}

			resolve();
		});
	});
}

function getImportCSS(async = false) {

	const scriptName = async
		? 'link-in-body-async'
		: 'link-in-body';

	const scriptPath = require.resolve(`import-css/lib/${scriptName}`);

	return Fs.readFile(scriptPath, 'utf8').then(script =>
		script
			.replace('\'use strict\';Object.defineProperty(exports,\'__esModule\',{value:!0}),exports.default', '!(function(w){\'use strict\';w.importCSS')
			.replace('module.exports=exports[\'default\'];', '})(window)')
	);
}

function getCSSPath(base, href) {

	const { pathname } = Url.parse(href),
		cssPath = Path.join(base, pathname);

	return cssPath;
}

function getCSS(path) {
	return Fs.readFile(path, 'utf8');
}

function resolveUrls(base, path) {
	return (match, quote, content) => {

		const skip = urlExcludes.some(_ => content.indexOf(_) === 0);

		if (skip) {
			return match;
		}

		const sourceName = Path.basename(content),
			sourcePath = Path.resolve(Path.dirname(path), Path.dirname(content)),
			newSourceRelativePath = Path.relative(base, sourcePath),
			newUrl = `url(${quote}${Path.join(newSourceRelativePath, sourceName)}${quote})`;

		return newUrl;
	};
}

function concatStyles(styles, base, stylesPath, getStylesFilename, htmlFilename) {

	const stylesFilename = getStylesFilename(htmlFilename),
		publicFilename = Path.join(stylesPath, stylesFilename),
		path = Path.join(base, stylesPath),
		filename = Path.join(base, publicFilename);

	const externalStyles = [],
		internalStyles = styles.filter((style) => {

			if (/^(http|\/\/)/.test(style[0])) {
				externalStyles.push(style);
				return false;
			}

			return true;
		});

	return Promise.all(internalStyles.map(([_]) => getCSS(getCSSPath(base, _))))
		.then(_ => _.join('\n'))
		.then(_ => mkdir(path).then(() => _))
		.then(_ => Fs.writeFile(filename, _, 'utf8'))
		.then(() => {
			externalStyles.push([publicFilename, false, false]);
			return externalStyles;
		});
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

export default function transform(_htmlFile, { base, noscript, preload, http1 }) {

	const htmlFile = _htmlFile.clone({ contents: false }),
		markup = htmlFile.contents.toString('utf8'),
		indent = detectIndent(markup).indent || '  ',
		nl = `\n${indent}${indent}`,
		headPoint = /(\n\s*<\/head>)/,
		mountPoint = /(\n\s*<\/body>)/,
		resolvedBase = Path.resolve(base);

	let h1 = false,
		h1StylesPath = '',
		h1GetStylesFilename = stylesNameFromHtmlFilename;

	htmlFile.dirname = htmlFile.dirname.replace(
		htmlFile.base.replace(/\/$/, ''),
		resolvedBase
	);
	htmlFile.base = resolvedBase;

	if (typeof http1 == 'boolean') {
		h1 = http1;
	} else
	if (typeof http1 == 'object' && http1 !== null) {

		h1 = true;

		if (typeof http1.path == 'string') {
			h1StylesPath = http1.path;
		}

		if (typeof http1.filename == 'function') {
			h1GetStylesFilename = http1.filename;
		}
	}

	const { markup: m, styles, scripts, async } = parse(markup);

	let transformedMarkup = m;

	return getImportCSS(async)
		.then((_) => {

			if (h1) {
				return concatStyles(scripts, base, h1StylesPath, h1GetStylesFilename, htmlFile.path)
					.then(__ => [_, __]);
			}

			return [_, scripts];
		})
		.then(([importCSS, scripts]) => {

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

			return Promise.all(styles.map(({ tagRegExp, href }) => {

				const path = getCSSPath(base, href);

				return getCSS(path).then((criticalCSS) => {
					transformedMarkup = transformedMarkup.replace(
						tagRegExp,
						`$1<style>${criticalCSS.trim().replace(
							searchUrl,
							resolveUrls(
								htmlFile.dirname,
								path
							)
						)}</style>`
					);
				});

			})).then(() =>
				transformedMarkup
			);
		});
}
