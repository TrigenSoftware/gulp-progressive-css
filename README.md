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
<link rel="stylesheet" priority="async"    href="font.css">
<link rel="stylesheet" priority="critical" href="critical.css">
<link rel="stylesheet" priority="queued"   href="content.css">
<link rel="stylesheet" priority="queued"   href="footer.css">
```

`critical` - means what this styles will be embedded into HTML file.

`queued` - means what this styles will be loaded asynchronously in specified order and without render blocking.

`async` - means what this styles will be loaded asynchronously outside of order and without render blocking.

# API

### `gulpProgressiveCSSPlugin([options])`

#### `String options.base`

Base directory to find CSS files.

Default: `./`

#### `Boolean options.noscript`

Adds `<noscript>` tag with all styles.

Default: `true`

#### `Boolean options.preload`

`<link rel="preload">` will be added to `<head>` for each style.

Default: `true`

#### `Object|Boolean http1`

All non-critical internal styles will concatenate into one file.

Default: `false`

#### `String http1.path`

Path to save concatenated styles, relative to `options.base`

Default: `''`

#### `String http1.filename(Stirng htmlFilename)`

Function to generate concatenated styles file name.

Default: `[html filename]-styles.css`

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
