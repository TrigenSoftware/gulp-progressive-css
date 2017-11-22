import through from 'through2';
import Transformer from './transformer';

export default function plugin(inputOptions) {

	const options = Object.assign({
		preload:  true,
		noscript: true,
		base:     './',
		http1:    false
	}, inputOptions);

	const transformer = new Transformer(options);

	async function each(file, enc, next) {

		if (file.isNull() || file.isStream()) {
			next(null, file);
			return;
		}

		try {

			const files = await transformer.transformHtmlFile(file);

			files.forEach((file) => {
				this.push(file);
			});

			next(null);
			return;

		} catch (err) {
			next(err);
			return;
		}
	}

	return through.obj(each);
}
