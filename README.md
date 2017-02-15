[![NPM](https://nodei.co/npm/gulp-progressive-css.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/gulp-progressive-css/)

# gulp-progressive-css

Transfrom `<link>` in HTML to progressive CSS loading.

# Getting Started

Install with npm
```bash
npm i -D gulp-progressive-css
```
or
```bash
yarn add -D gulp-progressive-css
```

# About

By using this plugin you can easily transform your simple HTML page to super fast HTML page with progressive CSS loading. You can do it by using custom `priority` attribute with `<link>` tag.

```html
<link rel="stylesheet" priority="critical" href="critical.css">
<link rel="stylesheet" priority="queued" href="content.css">
<link rel="stylesheet" priority="queued" href="footer.css">
```

`critical` - means what this styles will be embedded into HTML file.

`queued` - means what this styles will be loaded asynchronously in specified order and without render blocking.

# API

### `gulpProgressiveCSSPlugin([options])`

#### `String options.base`

Base directory to find CSS files.

Default: `./`

#### `String options.useXHR`

Load styles with `<link>` or using XMLHttpRequest. [You can get more info here.](https://github.com/TrigenSoftware/import-css#about)

Default: `false`

# Example 
[`gulpfile.js`](https://github.com/TrigenSoftware/gulp-progressive-css/tree/master/example)
```js
const gulp = require('gulp'),
	procss = require('gulp-progressive-css');

gulp.task('css', () =>
	gulp.src('src/*.css')
		.pipe(gulp.dest('dist'))
);

gulp.task('html', gulp.series('css', () =>
	gulp.src('src/*.html')
		.pipe(procss({ base: 'dist' }))
		.pipe(gulp.dest('dist'))
));
```
