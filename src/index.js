import transform from './transform';
import through from 'through2';

export default function plugin(inputOptions) {

	const options = Object.assign({
		useXHR:   false,
		noscript: true,
		preload:  true,
		base:     './'
	}, inputOptions);

	function each(file, enc, next) {

		if (file.isNull() || file.isStream()) {
			return next(null, file);
		}

		return transform(
			file.contents.toString('utf8'),
			options
		).then((markup) => {

			const transformedFile = file.clone({ contents: false });

			transformedFile.contents = new Buffer(markup);
			next(null, transformedFile);

		}).catch(next);
	}

	return through.obj(each);
}
