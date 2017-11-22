import Path from 'path';
import Url from 'url';
import Vinyl from 'vinyl';
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

	async loadCritical(htmlFileDirname) {
		await this.getStyles(this.critical, htmlFileDirname);
		return this;
	}

	async concat(publicPath, filename) {

		const publicFilename = Path.join(publicPath, filename),
			dest = Path.join(this.base, publicFilename);

		const internalStyles = this.styles
			.filter(({ href }) => !urlExcludes.test(href));

		const styles = await this.getStyles(internalStyles, Path.dirname(dest));

		const concatedStyles = styles
			.map(({ styles }) => styles)
			.join('\n');

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
	}

	async getStyle(href, overrideBase = false) {

		const { pathname } = Url.parse(href),
			path = Path.join(overrideBase || this.base, pathname);

		const styles = await Fs.readFile(path, 'utf8');

		return {
			path, styles
		};
	}

	getStyles(styles, urlsBase) {
		return Promise.all(
			styles.map(async (style) => {

				const { path, styles } = await this.getStyle(style.href, urlsBase);

				style.styles = styles.trim().replace(
					searchCssUrl,
					resolveCssUrls(
						urlsBase,
						path
					)
				);

				return style;
			})
		);
	}
}
