module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        'tasks/*.js',
      ]
    },
    less2sass2stylus2css: {
        options: {
            sourceMap: true
        },
        dist: {
            files: {
                'main.scss': 'main.styl'
            }
        }
    }
  });
  grunt.registerTask('default', ['less2sass2stylus2css']);
  grunt.loadTasks('tasks');
};