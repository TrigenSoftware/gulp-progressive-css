import Transformer from './transformer';
import through from 'through2';

export default function plugin(inputOptions) {

	const options = Object.assign({
		preload:  true,
		noscript: true,
		base:     './',
		http1:    false
	}, inputOptions);

	const transformer = new Transformer(options);

	function each(file, enc, next) {

		if (file.isNull() || file.isStream()) {
			next(null, file);
			return;
		}

		transformer.transformHtmlFile(file).then((files) => {
			files.forEach(file => this.push(file));
			next(null);
		}).catch(next);
	}

	return through.obj(each);
}
