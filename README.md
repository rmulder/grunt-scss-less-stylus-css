# grunt-scss-less-stylus-css
Grunt task to convert LESS into SCSS, CSS and Stylus, to convert SCSS into LESS, Stylus and CSS and to convert Stylus into SCSS, LESS and CSS

##Install

```
$ npm install --save-dev grunt-scss-less-stylus-css
```


##Usage

```js
require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks

grunt.initConfig({
    less2sass2stylus2css: {
        options: {
            sourceMap: true
        },
        dist: {
            files: {
                'main.css': 'main.scss'
            }
        }
    }
});

grunt.registerTask('default', ['less2sass2stylus2css']);
```


##Options

Your Sourcefile could be a LESS or a SCSS or a Stylus.
Your Targetfile could be either a LESS or a SCSS or a Stylus or a CSS.

##Attention

From Stylus to LESS or SCSS you can have only two nestings like:

```css
content
  float: left
  width: 20px
  &:hover
    width: 40px
	box
	  color: #fff
```

From Stylus to LESS or SCSS you can also only use variables and mixins. Functions or Keyframes arn't implemented.
	
	