const gulp = require('gulp'),
	procss = require('../lib/index');

gulp.task('css', () =>
	gulp.src('src/**/*.css')
		.pipe(gulp.dest('dist'))
);

gulp.task('html', gulp.series('css', () =>
	gulp.src('src/**/*.html')
		.pipe(procss({ base: 'dist' }))
		.pipe(gulp.dest('dist'))
));
