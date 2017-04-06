import Vinyl from 'vinyl';
import Path from 'path';
import Url from 'url';
import Fs from 'pn/fs';

const searchCssUrl = /url\((['"]?)(.+?)\1\)/g,
	cssUrlExcludes = /^(\/|data:|http:|https:)/,
	urlExcludes    = /^(\/\/|http:|https:)/;

function resolveCssUrls(base, path) {
	return (match, quote, content) => {

		if (cssUrlExcludes.test(content)) {
			return match;
		}

		const sourceName = Path.basename(content),
			sourcePath = Path.resolve(Path.dirname(path), Path.dirname(content)),
			newSourceRelativePath = Path.relative(base, sourcePath),
			newUrl = `url(${quote}${Path.join(newSourceRelativePath, sourceName)}${quote})`;

		return newUrl;
	};
}

export default class Styles {

	base = './';
	critical = [];
	styles = [];
	concated = null;
	includesAsync = false;

	constructor(base, critical, styles, includesAsync) {

		if (typeof base == 'string') {
			this.base = base;
		}

		if (Array.isArray(critical)) {
			this.critical = critical;
		}

		if (Array.isArray(styles)) {
			this.styles = styles;
		}

		this.includesAsync = Boolean(includesAsync);
	}

	loadCritical(htmlFileDirname) {
		return this.getStyles(this.critical, htmlFileDirname).then(() => this);
	}

	concat(publicPath, filename) {

		const publicFilename = Path.join(publicPath, filename),
			dest = Path.join(this.base, publicFilename);

		const internalStyles = this.styles.filter(({ href }) => !urlExcludes.test(href));

		return this.getStyles(internalStyles, Path.dirname(dest)).then((_) => {

			const concatedStyles = _.map(({ styles }) => styles).join('\n');

			this.concated = {
				href:      publicFilename,
				styles:    concatedStyles,
				file:      new Vinyl({
					path:     dest,
					contents: new Buffer(concatedStyles)
				}),
				importCSS: [publicFilename]
			};

			return this.concated;
		});
	}

	getStyle(href) {

		const { pathname } = Url.parse(href),
			path = Path.join(this.base, pathname);

		return Fs.readFile(path, 'utf8').then(styles => ({
			path, styles
		}));
	}

	getStyles(styles, urlsBase) {
		return Promise.all(styles.map(style =>
			this.getStyle(style.href).then(({ path, styles }) => {

				style.styles = styles.trim().replace(
					searchCssUrl,
					resolveCssUrls(
						urlsBase,
						path
					)
				);

				return style;
			})
		));
	}
}
