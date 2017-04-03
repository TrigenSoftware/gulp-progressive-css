import transform from './transform';
import through from 'through2';

export default function plugin(inputOptions) {

	const options = Object.assign({
		noscript: true,
		preload:  true,
		base:     './',
		http1:    false
	}, inputOptions);

	function each(file, enc, next) {

		if (file.isNull() || file.isStream()) {
			return next(null, file);
		}

		return transform(
			file,
			options
		).then((markup) => {

			const transformedFile = file.clone({ contents: false });

			transformedFile.contents = new Buffer(markup);
			next(null, transformedFile);

		}).catch(next);
	}

	return through.obj(each);
}
