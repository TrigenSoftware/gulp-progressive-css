import { HTMLParser } from 'html-minifier/src/htmlparser';
import detectIndent from 'detect-indent';
import Styles from './styles';
import Path from 'path';
import Fs from 'pn/fs';

const urlExcludes  = /^(\/\/|http:|https:)/,
	headPoint      = /(\n\s*<\/head>)/,
	footerPoint    = /(\n\s*<\/body>)/;

function objectToNameValue(obj) {

	if (Array.isArray(obj)) {
		return obj;
	}

	return Object.keys(obj).map(key => ({
		name:  key,
		value: obj[key]
	}));
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

function getImportCSS(async = false) {

	const scriptName = async
		? 'link-in-body-async'
		: 'link-in-body';

	const scriptPath = require.resolve(`import-css/lib/${scriptName}`);

	return Fs.readFile(scriptPath, 'utf8').then(script =>
		script
			.replace('\'use strict\';Object.defineProperty(exports,\'__esModule\',{value:!0}),exports.default', '!(function(w){\'use strict\';w.importCSS')
			.replace('module.exports=exports[\'default\'];', '})(window)')
			.trim()
	);
}

function stylesNameFromHtmlFilename(htmlFilename) {
	return `${Path.basename(
		htmlFilename,
		Path.extname(htmlFilename)
	)}-styles.css`;
}

export default class Transfromer {

	preload = true;
	noscript = true;
	base = Path.resolve('./');
	http1 = false;

	constructor(inputOptions) {

		const options = Object.assign({
			preload:  this.preload,
			noscript: this.noscript,
			base:     this.base,
			http1:    this.http1
		}, inputOptions);

		this.preload = options.preload;
		this.noscript = options.noscript;
		this.base = options.base;

		let { http1 } = options;

		if (http1) {
			http1 = Object.assign({
				dirname:  '',
				filename: stylesNameFromHtmlFilename
			}, http1);
		}

		this.http1 = http1;
	}

	getStyles(links) {

		const critical = [],
			styles = [];

		let includesAsync = false;

		links.forEach((_attrs) => {

			const attrs = objectToNameValue(_attrs);

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

			}).join('')}\\s*(/|)>`);

			if (rel == 'stylesheet' && typeof href == 'string') {

				if (priority == 'critical' && !urlExcludes.test(href)) {

					critical.push({
						tagRegExp,
						source:    attrs,
						priority,
						media,
						href,
						styles:    '',
						importCSS: null
					});

				} else
				if (priority == 'queued' || priority == 'async') {

					const isAsyncPriority = priority == 'async';

					if (isAsyncPriority) {
						includesAsync = isAsyncPriority;
					}

					styles.push({
						tagRegExp,
						source:    attrs,
						priority,
						media,
						href,
						styles:    '',
						importCSS: [href, media, isAsyncPriority]
					});
				}
			}
		});

		return new Styles(
			this.base,
			critical,
			styles,
			includesAsync
		);
	}

	getStylesFromHtml(markup) {

		const links = [];

		HTMLParser(markup, {
			html5: true,
			start(tag, attrs) {

				if (tag == 'link') {
					links.push(attrs);
				}
			}
		});

		return this.getStyles(links);
	}

	buildImportsObject(styles, htmlFileDirname, http1ConcatedStylesFilename) {

		const tasks = [styles.loadCritical(htmlFileDirname), getImportCSS(styles.includesAsync)];

		if (this.http1) {
			tasks.push(styles.concat(this.http1.dirname, http1ConcatedStylesFilename));
		}

		return Promise.all(tasks).then(([styles, importCSS, concatedStyles]) => {

			const importsObject = {
				head:   {
					critical: styles.critical.map(({ styles }) => styles),
					preload:  [],
					noscript: []
				},
				footer: {
					importCSS,
					imports: []
				}
			};

			if (this.http1) {
				importsObject.footer.imports = [concatedStyles.importCSS];
			} else {
				importsObject.footer.imports = styles.styles.map(({ importCSS }) => importCSS);
			}

			if (this.preload) {

				if (this.http1) {
					importsObject.head.preload = [concatedStyles.href];
				} else {
					importsObject.head.preload = styles.styles.map(({ href }) => href);
				}
			}

			if (this.noscript) {
				importsObject.head.noscript = importsObject.footer.imports;
			}

			return importsObject;
		});
	}

	buildImportsHtmlStrings(styles, htmlFileDirname, http1ConcatedStylesFilename) {
		return this.buildImportsObject(styles, htmlFileDirname, http1ConcatedStylesFilename).then(importsObject => ({
			head:   {
				critical: importsObject.head.critical,
				preload:  importsObject.head.preload.map(href =>
					`<link rel="preload" as="style" href="${href}">`
				),
				noscript: importsObject.head.noscript.map(([href, media]) =>
					`<link rel="stylesheet" href="${href}"${media ? ` media=${media}` : ''}>`
				)
			},
			footer: {
				importCSS: importsObject.footer.importCSS,
				imports:   importsObject.footer.imports.map(_ =>
					`importCSS(${argsToString(_)});`
				)
			}
		}));
	}

	cleanupHtml(markup, styles) {
		return [...styles.critical, ...styles.styles]
			.reduce((markup, { tagRegExp }) => markup.replace(tagRegExp, ''), markup);
	}

	injectImports(_markup, importsHtmlStrings) {

		let markup = _markup;

		const {
			head:   { critical, preload, noscript },
			footer: { importCSS, imports }
		} = importsHtmlStrings;

		const indent = detectIndent(markup).indent || '  ',
			nl = `\n${indent}${indent}`;

		markup = markup.replace(
			headPoint,
			`${nl}<style>${critical.join('\n')}</style>$1`
		);

		if (this.preload) {
			markup = markup.replace(
				headPoint,
				`${preload.map(_ => `${nl}${_}`).join('')}$1`
			);
		}

		if (this.noscript) {
			markup = markup.replace(
				headPoint,
				`${nl}<noscript>${
					noscript.map(_ => `${nl}${indent}${_}`).join('')
				}${nl}</noscript>$1`
			);
		}

		markup = markup.replace(
			footerPoint,
			`${nl}<script>${nl}${indent}${importCSS};${
				imports.map(_ => `${nl}${indent}${_}`).join('')
			}${nl}</script>$1`
		);

		return markup;
	}

	transformHtmlFile(htmlFile) {

		const markup = htmlFile.contents.toString('utf8'),
			destDirname = htmlFile.dirname.replace(
				htmlFile.base.replace(/\/$/, ''),
				this.base
			),
			styles = this.getStylesFromHtml(markup);

		let http1ConcatedStylesFilename = false;

		if (this.http1) {
			http1ConcatedStylesFilename = this.http1.filename(htmlFile.path);
		}

		return this.buildImportsHtmlStrings(styles, destDirname, http1ConcatedStylesFilename)
		.then((importsHtmlStrings) => {

			const transformedHtmlFile = htmlFile.clone({ contents: false });

			transformedHtmlFile.contents = new Buffer(
				this.injectImports(
					this.cleanupHtml(markup, styles),
					importsHtmlStrings
				)
			);

			const files = [transformedHtmlFile];

			if (this.http1) {

				const { file } = styles.concated,
					finaleFile = htmlFile.clone({ contents: false });

				finaleFile.contents = file.contents;
				finaleFile.path = file.path;

				files.push(finaleFile);
			}

			return files;
		});
	}
}
