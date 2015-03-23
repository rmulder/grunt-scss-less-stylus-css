'use strict';

var async = require('async');
var path = require('path');
var _ = require('lodash');
var chalk = require('chalk');
var less = require('less');



module.exports = function(grunt){
	var warnReal = grunt.fail.warn;
	var warnFake = function () {
		arguments[0] = 'Warning '.cyan + arguments[0];
		grunt.log.writeln.apply(null, arguments);
	};

	var fs = require('fs');
		
	grunt.registerMultiTask('less2sass2stylus2css', 'Convert Less to CSS, SCSS or Stylus or SCSS to Less, CSS or Stylus or Stylus to Less, SCSS or CSS', function() {
	  
		var done = this.async();

    var options = this.options({
      report: 'min',
      includePaths: [],
			outputStyle: 'nested',
			sourceComments: 'none',
			separator: grunt.util.linefeed,
			banner: '',
			compress: false
    });

    var banner = options.banner;

    var filesCreatedCount = 0;

    if (options.basePath || options.flatten) {
      grunt.fail.warn('Experimental destination wildcards are no longer supported. Please refer to README.');
    }

    if (this.files.length < 1) {
      grunt.verbose.warn('Destination not written because no source files were provided.');
    }
	
		grunt.verbose.writeflags(options, 'Options');

		var count = 0;

    async.eachSeries(this.files, function(f, nextFileObj) {

      var destFile = f.dest;
    	
      var files = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
        	grunt.log.writeln('source file ' + f.src[0].split(".").pop());
          return true;
        }
      });

      if (files.length === 0) {
        if (f.src.length < 1) {
          grunt.log.warn('Destination ' + chalk.cyan(destFile) + ' not written because no source files were found.');
        }

        // No src files, goto next target. Warn would have been issued above.
        return nextFileObj();
      }
      if(f.src[0].split(".").pop() == 'sass' || f.src[0].split(".").pop() == 'scss'){
	      if(destFile.split(".").pop() == 'css'){
	      	var sass = require('node-sass');
	      	sass.render({
						file: f.src[0],
						success: function (css) {
							grunt.file.write(destFile, css);
							grunt.log.writeln('File "' + destFile + '" created.');
							nextFileObj();
						},
						error: function (err) {
							grunt.warn(err);
						},
						includePaths: options.includePaths,
						outputStyle: options.outputStyle,
						sourceComments: options.sourceComments
					});
				} else if(f.src[0].split(".").pop() == 'scss' && destFile.split(".").pop() == 'less'){
		      var lessCode;
		      var i = 0;

		      async.concatSeries(files, function(file, next) {

		       convertSCSS(file, options, function(less, err) {
		          if (!err) {
		            lessCode = less;
		            process.nextTick(next);					
		          } else {
		            nextFileObj(err);
		          }
		        });
		      }, 
		      function() {
		        if (lessCode.length < 1) {
		          grunt.log.warn('Destination ' + chalk.cyan(destFile) + ' not written because compiled files were empty.');
		        } else {
		          grunt.file.write(destFile, lessCode);
		          grunt.log.writeln('File ' + chalk.cyan(destFile) + ' created');
		        }
		        nextFileObj();
		      });
					
		    }else if(destFile.split(".").pop() == "styl"){
		    	var sourceFile = f.src[0];
		    	var convertStyl = function (sass) {
					return sass

						// remove opening brackets
						.replace(/^(\ *)(.+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
						// remove opening brackets
						//.replace(/^(\ *)([^\ \n]+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
						 // remove opening brackets again (some random cases I'm too lazy to think through)
						.replace(/\ *\{\ *\n*/g, "")
						 // remove closing brackets
						.replace(/\ *\}\ *\n*/g, "")
				 
						// remove semicolons
						.replace(/\;\ *?$/gm, "")

						.replace(/(@-[a-zA-Z]+-[a-zA-Z]+)({\$[a-zA-Z]+[}])/g, "$1")

						.replace(/(\#)(\$[a-zA-Z]+)/g, "{$2}")

						.replace(/(@mixin) ([a-zA-Z][\w-]+[\(])/g, "$2")

						.replace(/(@mixin) ([a-zA-Z][\w-]+)/g, "$2()")

						.replace(/(@include) ([a-zA-Z][\w-]+[\(])/g, "$2")

						.replace(/(@include) ([a-zA-Z][\w-]+)/g, "$2()")

						.replace(/@content/g, "{block}")
				
					}
		  
					var stylus = convertStyl(fs.readFileSync(sourceFile, "utf-8"));
					fs.writeFileSync(destFile, stylus);

					if(stylus != ''){
						grunt.verbose.writeln('File ' + chalk.cyan(destFile) + ' created.');
					}
		    }
		  }else if(f.src[0].split(".").pop() == 'less'){
		  	if(destFile.split(".").pop() == 'css'){

		  		var compiled = [];
		      var i = 0;

		      async.concatSeries(files, function(file, next) {
		        if (i++ > 0) {
		          options.banner = '';
		        }

		        compileLess(file, destFile, options)
		          .then(function(output) {
		            compiled.push(output.css);
		            if (options.sourceMap && !options.sourceMapFileInline) {
		              var sourceMapFilename = options.sourceMapFilename;
		              if (!sourceMapFilename) {
		                sourceMapFilename = destFile + '.map';
		              }
		              grunt.file.write(sourceMapFilename, output.map);
		              grunt.log.writeln('File ' + chalk.cyan(sourceMapFilename) + ' created.');
		            }
		            var allCss = compiled.join(options.compress ? '' : grunt.util.normalizelf(grunt.util.linefeed));
			          grunt.file.write(destFile, allCss);
			          grunt.log.writeln('File ' + chalk.cyan(destFile) + ' created');
		            //process.nextTick(next);
		          },
		          function(err) {
		            nextFileObj(err);
		          });
		      });
		  	}else if (destFile.split(".").pop() == 'styl'){
		  		var convertLess = function (less) {
						return less
							// remove opening brackets
							//.replace(/^(\ *)(.+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
							// remove opening brackets
							//.replace(/^(\ *)([^\ \n]+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
							 // remove opening brackets again (some random cases I'm too lazy to think through)
							//.replace(/\ *\{\ *\n*/g, "\n")
							 // remove closing brackets
							//.replace(/\ *\}\ *\n*/g, "\n")

							// remove semicolons
							//.replace(/\;\ *?$/gm, "")

							// replace @variable: with $variable =
							.replace(/@(\w+):(\ *)\ /g, function(_, $1, $2) {
								return "$" + $1 + $2 + " = ";
							})
							// replace all other variable call, careful with native @{keyword}
							.replace(/\@(\w+)/g, function(_, $1) {
								if ($1 === "import" || $1 == "media") {
									return _;
								} else {
									return "$" + $1;
								}
							})

							// replace @{variable} with {$variable}
							.replace(/@\{(\w+)\}/g, function(_, $1) {
								return '{$' + $1 +'}';
							})

							// replace mixins from .border-radius(4px) to border-radius(4px)
							.replace(/\.([\w-]+) ?\(/g, "$1(")

							// switch this two lines if you want to disable @extend behavior
							//.replace(/(\.[a-zA-Z][\w-]+;)/g, "@extend $1") // replace mixins without args by @extend
							.replace(/\.([a-zA-Z][\w-]+);/g, "$1();") // replace mixins without args

							.replace(/(\ *)(.+)>\ *([\w-]+)\(/g, "$1$2>\n$1  $3(")

							// ms filter fix
							.replace(/filter: ([^'"\n;]+)/g, 'filter: unquote("$1")')

							// url data
							.replace(/: ?url\(([^'"\)]+)\)/g, ': url(unquote("$1"))')

							// rename (useless)
							.replace(/\.less/g, ".styl")

							// tinies optimizations

							// make all commas have 1 space after them
							.replace(/,\ */g, ", ")

							// replace 0.x by .x
							.replace(/(:\ )0\.([0-9])+/g, ".$2 ")

							// remove trailing whitespace
							.replace(/\ *$/g, "");
					}
				  
					var stylus = convertLess(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, stylus);

					if(stylus != ''){
						grunt.verbose.writeln('File ' + chalk.cyan(destFile) + ' created.');
					}

		  	}else if(destFile.split(".").pop() == 'scss'){
		  		var scssConvert = function(less) {

					  return less

					  .replace(/(\s|^)\.([\w\-]*\(?.*\)?;)/g, '$1@include $2')

					  .replace(/\.([\w\-]*)\s*\((.*)\)\s*\{/g, '@mixin $1($2) {')

					  .replace(/spin\(/g, 'adjust-hue(')

					  .replace(/@(?!(media|import|mixin|font-face)(\s|\())/g, '$');
					};

					var sass = scssConvert(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, sass);

					if(sass != ''){
						grunt.verbose.writeln('File ' + chalk.cyan(destFile) + ' created.');
					}
		  	}
		  }else if(f.src[0].split(".").pop() == 'styl'){
		  	if(destFile.split(".").pop() == '' || destFile.split(".").pop() != 'css' || destFile.split(".").pop() != 'scss' || destFile.split(".").pop() != 'less'){
		  		grunt.log.warn('Destination ' + chalk.cyan(destFile) + ' not written because an Error.');
		  	}
		  	if(destFile.split(".").pop() == 'css'){

		  		var destFile = path.normalize(f.dest);
		      var srcFiles = f.src.filter(function(filepath) {
		        // Warn on and remove invalid source files (if nonull was set).
		        if (!grunt.file.exists(filepath)) {
		          grunt.log.warn('Source file "' + filepath + '" not found.');
		          return false;
		        }
		        return true;
		      });

		      if (srcFiles.length === 0) {
		        // No src files, goto next target. Warn would have been issued above.
		        return nextFileObj();
		      }

		      var compiled = [];
		      async.concatSeries(srcFiles, function(file, next) {
		        compileStylus(file, options, function(css, err) {
		          if (!err) {
		            compiled.push(css);
		            next(null);
		          } else {
		            nextFileObj(false);
		          }
		        });
		      }, function() {
		        if (compiled.length < 1) {
		          grunt.log.warn('Destination not written because compiled files were empty.');
		        } else {
		          grunt.file.write(destFile, banner + compiled.join(grunt.util.normalizelf(grunt.util.linefeed)));
		          grunt.verbose.writeln('File ' + chalk.cyan(destFile) + ' created.');
		          filesCreatedCount++;
		        }
		        nextFileObj();
		      });
		  	}else if(destFile.split(".").pop() == 'less'){
		  		var convertStylLess = function (stylus) {
						var stylus = stylus

						.replace(/\*([^*]|[\r\n]|(\*([^\/]|[\r\n])))*\*/g, "")
						//add class selector and opening bracket
						.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)/g, ".$1{")
						//add class selector and opening bracket for mixin without argument
						//.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)([(][)])/g, ".$1$2{")
						//add class selector and opening bracket for mixin with argument
						.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)([(][0-9a-zA-Z]+[)])/g, ".$1$2{")
						//add opening bracket for mixin with variable as argument
						.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)([(])([a-zA-Z]+)([)]+)/g, "$1$2@$3$4{")
						//add opening bracket
						.replace(/(\.[a-zA-Z-]+\n)/g, "$1{")

						.replace(/(.[a-zA-Z]+)(\{)([(][)])/g, "$1$3{")
						//remove unused bracket
						.replace(/([\$])([\.])([a-zA-Z]+)(\{)/g, "$1$3")

						.replace(/(-)([\.])([a-zA-Z-]+)(\{)/g, "$1$3")

						.replace(/(-)([a-zA-Z-]+:)([\w]*)( [\{])([\$])([a-zA-Z]+)([\}])/g, "$1$2$3@$6;")

						.replace(/([a-zA-Z]+[\{][\n\w]|-?[a-zA-Z-]+:[\w]* [@][a-zA-Z]+[\;])/g, "$1\n  }")

						.replace(/(&[\:])([\.])([a-zA-Z]+)/g, "$1$3")

						.replace(/([\.])([-a-zA-Z]+|[a-zA-Z]+)([\{])([(])([\$]|[@])([a-zA-Z]+[)])/g, "$1$2$4$5$6 {")

						.replace(/(\.[a-zA-Z]+)([-a-zA-Z]+\()(\$)([a-zA-Z]+\))/g, "$1$2@$4")			
						//remove unused bracket in mixin
						.replace(/( [-a-zA-Z:]+)( .)([a-zA-Z]+[-a-zA-Z]+| .[a-zA-Z]+)(\{)/g, "$1$3")			
						//remove unused bracket
						.replace(/( [-a-zA-Z:]+\([-0-9]+)(\.)([a-zA-Z]+)(\{)(\))/g, "$1$3$5")	 
						//remove unused bracket
						.replace(/( \.)([a-zA-Z]+)(\{)(:)( \.)([a-zA-Z]+)(\{)(\([-0-9]+)(\.)([a-zA-Z]+)(\{)(\))/g, " $2$4$6$8$10$12")	
						.replace(/( \.)([a-zA-Z-]+)(\{)(:)( \.?)([0-9a-zA-Z]+|[a-zA-Z]+)(\{?)([-0-9a-zA-Z]+)(\{?)(%?)/g, " $2$4$6$8$10")
						//add semicolon
						.replace(/(( [-a-zA-Z:]+)(\([0-9]\, [0-9]\)|\([0-9]\.[0-9]\, [0-9]\.[0-9]\)|\([0-9]+[a-zA-Z]+\)| [0-9a-zA-Z]+|[0-9a-zA-Z%]+|\([-0-9a-zA-Z]+\)|))/g, "$1;")
						//.replace(/(( [-a-zA-Z:]+)(\([0-9]\, [0-9]\)|\([0-9]\.[0-9]\, [0-9]\.[0-9]\)|\([0-9]+[a-zA-Z]+\)|))/g, "$1;")
						//remove unused semicolon
						.replace(/([-a-zA-Z:]+)(\;)( [0-9a-zA-Z]+)/g, "$1$3")
						.replace(/([-a-zA-Z]+:[a-zA-Z]+)(\;)(\([-0-9a-zA-Z]+\))/g, "$1$3;")
						.replace(/( \.[a-zA-Z-]+\(\))(\{)/g, "$1;")
						.replace(/( \.[a-zA-Z-]+)(\{)(\()("\.)([a-zA-Z-]+)(\{)([-a-zA-Z]+ [0-9a-zA-Z]+)(")(\))/g, "$1$3$5$7$9;")
						.replace(/( \.[a-zA-Z]+)(\{)(\()("\.)([a-zA-Z]+)(\{)( [0-9a-zA-Z]+)(")(\))/g, "$1$3$5$7$9;")
						//remove unused semicolon
						.replace(/([-a-zA-Z]+:)(\;)(@[a-zA-Z]+)/g, "$1$3")

						.replace(/(\.)(\.[a-zA-Z-]+\{)/g, "$2");

						var newStylus = "";
						 
						var lastTabCount = 0;
						var currentTabCount = 0;
						var lines = stylus.split("\n");
						 
						for (var i = 0; i < lines.length; i++) {
	            var line = lines[i];
	            
	            if(!line.match(/([a-z]+)/g)) {
                newStylus += "\n" + line;
                continue;
	            }
	           
	          	if(line.match(/(  )/g) == null){
	          		currentTabCount = 0;
          		}else{
	          		currentTabCount = line.match(/(  )/g).length;
	          	}
	        
	            if(lastTabCount > currentTabCount) {
								newStylus += "\n}\n" + line;							
	            } else {
                newStylus += "\n" + line;
	            }
	         
	           	if(line == lines[lines.length -1]){
	            	newStylus += "\n}\n";
	            }

	            lastTabCount = currentTabCount;
	           
						}

						var newStylus2 = "";
						var lastTabCount2 = 0;
						var currentTabCount2 = 0;
						var lines2 = newStylus.split("\n");
						 
						for (var j = 0; j < lines2.length; j++) {
	            var line2 = lines2[j];
	            
	            if(!line.match(/([a-z]+)/g)) {
                newStylus2 += "\n" + line2;
                continue;
	            }
	           
	          	if(line2.match(/(    )/g) == null){
	          		currentTabCount2 = 0;
          		}else{
	          		currentTabCount2 = line2.match(/(    )/g).length;
	          	}
	        
	            if(lastTabCount2 > currentTabCount2) {
								newStylus2 += "\n  }\n" + line2;							
	            } else {
                newStylus2 += "\n" + line2;
	            }
	         	         
	            lastTabCount2 = currentTabCount2;
	           
						}

						var newStylus3 = "";
						var lastTabCount3 = 0;
						var currentTabCount3 = 0;
						var lines3 = newStylus2.split("\n");
						 
						for (var k = 0; k < lines3.length; k++) {
	            var line3 = lines3[k];
	            
	            if(!line.match(/([a-z]+)/g)) {
                newStylus3 += "\n" + line3;
                continue;
	            }
	           
	          	if(line3.match(/(      )/g) == null){
	          		currentTabCount3 = 0;
          		}else{
	          		currentTabCount3 = line3.match(/(      )/g).length;
	          	}
	        
	            if(lastTabCount3 > currentTabCount3) {
								newStylus3 += "\n    }\n" + line3;							
	            } else {
                newStylus3 += "\n" + line3;
	            }
	         	         
	            lastTabCount3 = currentTabCount3;
	           
						}

						//grunt.log.writeln(newStylus3);
						return newStylus3;
					}
				  
					var less = convertStylLess(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, less);

					if(less != ''){
						grunt.verbose.writeln('File ' + chalk.cyan(destFile) + ' created.');
					}

		  	}else if(destFile.split(".").pop() == 'scss'){
		  		var convertStylScss = function (stylus) {
						var stylus = stylus

						.replace(/\*([^*]|[\r\n]|(\*([^\/]|[\r\n])))*\*/g, "")
						//add class selector and opening bracket
						.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)/g, ".$1{")
						//add class selector and opening bracket for mixin without argument
						//.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)([(][)])/g, ".$1$2{")
						//add class selector and opening bracket for mixin with argument
						.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)([(][0-9a-zA-Z]+[)])/g, ".$1$2{")
						//add opening bracket for mixin with variable as argument
						.replace(/([a-zA-Z]+[\w-][a-zA-Z]+)([(])([a-zA-Z]+)([)]+)/g, "$1$2$3$4{")
						//add opening bracket
						.replace(/(\.[a-zA-Z-]+\n)/g, "$1{")

						.replace(/(.[a-zA-Z]+)(\{)([(][)])/g, "$1$3{")
						//remove unused bracket
						.replace(/([\$])([\.])([a-zA-Z]+)(\{)/g, "$1$3")

						.replace(/(-)([\.])([a-zA-Z-]+)(\{)/g, "$1$3")

						.replace(/(-)([a-zA-Z-]+:)([\w]*)( [\{])([\$])([a-zA-Z]+)([\}])/g, "$1$2$3@$6;")

						.replace(/([a-zA-Z]+[\{][\n\w]|-?[a-zA-Z-]+:[\w]* [@][a-zA-Z]+[\;])/g, "$1\n  }")

						.replace(/(&[\:])([\.])([a-zA-Z]+)/g, "$1$3")

						.replace(/([\.])([-a-zA-Z]+|[a-zA-Z]+)([\{])([(])([\$]|[@])([a-zA-Z]+[)])/g, "$1$2$4$5$6 {")

						.replace(/(\.[a-zA-Z]+)([-a-zA-Z]+\()(\$)([a-zA-Z]+\))/g, "$1$2@$4")			
						//remove unused bracket in mixin
						.replace(/( [-a-zA-Z:]+)( .)([a-zA-Z]+[-a-zA-Z]+| .[a-zA-Z]+)(\{)/g, "$1$3")			
						//remove unused bracket
						.replace(/( [-a-zA-Z:]+\([-0-9]+)(\.)([a-zA-Z]+)(\{)(\))/g, "$1$3$5")	 
						//remove unused bracket
						.replace(/( \.)([a-zA-Z]+)(\{)(:)( \.)([a-zA-Z]+)(\{)(\([-0-9]+)(\.)([a-zA-Z]+)(\{)(\))/g, " $2$4$6$8$10$12")	
						.replace(/( \.)([a-zA-Z-]+)(\{)(:)( \.?)([0-9a-zA-Z]+|[a-zA-Z]+)(\{?)([-0-9a-zA-Z]+)(\{?)(%?)/g, " $2$4$6$8$10")
						//add semicolon
						.replace(/(( [-a-zA-Z:]+)(\([0-9]\, [0-9]\)|\([0-9]\.[0-9]\, [0-9]\.[0-9]\)|\([0-9]+[a-zA-Z]+\)| [0-9a-zA-Z]+|[0-9a-zA-Z%]+|\([-0-9a-zA-Z]+\)|))/g, "$1;")
						//.replace(/(( [-a-zA-Z:]+)(\([0-9]\, [0-9]\)|\([0-9]\.[0-9]\, [0-9]\.[0-9]\)|\([0-9]+[a-zA-Z]+\)|))/g, "$1;")
						//remove unused semicolon
						.replace(/([-a-zA-Z:]+)(\;)( [0-9a-zA-Z]+)/g, "$1$3")
						.replace(/([-a-zA-Z]+:[a-zA-Z]+)(\;)(\([-0-9a-zA-Z]+\))/g, "$1$3;")
						.replace(/( \.[a-zA-Z-]+\(\))(\{)/g, "$1;")
						.replace(/( \.[a-zA-Z-]+)(\{)(\()("\.)([a-zA-Z-]+)(\{)([-a-zA-Z]+ [0-9a-zA-Z]+)(")(\))/g, "$1$3$5$7$9;")
						.replace(/( \.[a-zA-Z]+)(\{)(\()("\.)([a-zA-Z]+)(\{)( [0-9a-zA-Z]+)(")(\))/g, "$1$3$5$7$9;")
						//remove unused semicolon
						.replace(/([-a-zA-Z]+:)(\;)(@[a-zA-Z]+)/g, "$1$3")

						.replace(/(\.)(\.[a-zA-Z-]+\{)/g, "$2")

						.replace(/(@)/g, "$")

						.replace(/(.)([a-zA-Z-]+\(\)\{)/g, "@mixin $2")

						.replace(/( \.)([a-zA-Z-]+\(\)\;)/g, " @include $2")

						.replace(/( \.)([a-zA-Z-]+)(\()([a-zA-Z-]+ [0-9a-zA-Z]+)(\)\;)/g, " @include $2$3'$4'$5")

						.replace(/(\.)([a-zA-Z-]+\(\$[a-zA-Z-]+\))/g, "@mixin $2")

						.replace(/(\:)(\$[a-zA-Z-]+)/g, "$1 #{$2}");

						var newStylus = "";
						 
						var lastTabCount = 0;
						var currentTabCount = 0;
						var lines = stylus.split("\n");
						 
						for (var i = 0; i < lines.length; i++) {
	            var line = lines[i];
	            
	            if(!line.match(/([a-z]+)/g)) {
                newStylus += "\n" + line;
                continue;
	            }
	           
	          	if(line.match(/(  )/g) == null){
	          		currentTabCount = 0;
          		}else{
	          		currentTabCount = line.match(/(  )/g).length;
	          	}
	        
	            if(lastTabCount > currentTabCount) {
								newStylus += "\n}\n" + line;							
	            } else {
                newStylus += "\n" + line;
	            }
	         
	           	if(line == lines[lines.length -1]){
	            	newStylus += "\n}\n";
	            }

	            lastTabCount = currentTabCount;
	           
						}

						var newStylus2 = "";
						var lastTabCount2 = 0;
						var currentTabCount2 = 0;
						var lines2 = newStylus.split("\n");
						 
						for (var j = 0; j < lines2.length; j++) {
	            var line2 = lines2[j];
	            
	            if(!line.match(/([a-z]+)/g)) {
                newStylus2 += "\n" + line2;
                continue;
	            }
	           
	          	if(line2.match(/(    )/g) == null){
	          		currentTabCount2 = 0;
          		}else{
	          		currentTabCount2 = line2.match(/(    )/g).length;
	          	}
	        
	            if(lastTabCount2 > currentTabCount2) {
								newStylus2 += "\n  }\n" + line2;							
	            } else {
                newStylus2 += "\n" + line2;
	            }
	         	         
	            lastTabCount2 = currentTabCount2;
	           
						}

						var newStylus3 = "";
						var lastTabCount3 = 0;
						var currentTabCount3 = 0;
						var lines3 = newStylus2.split("\n");
						 
						for (var k = 0; k < lines3.length; k++) {
	            var line3 = lines3[k];
	            
	            if(!line.match(/([a-z]+)/g)) {
                newStylus3 += "\n" + line3;
                continue;
	            }
	           
	          	if(line3.match(/(      )/g) == null){
	          		currentTabCount3 = 0;
          		}else{
	          		currentTabCount3 = line3.match(/(      )/g).length;
	          	}
	        
	            if(lastTabCount3 > currentTabCount3) {
								newStylus3 += "\n    }\n" + line3;							
	            } else {
                newStylus3 += "\n" + line3;
	            }
	         	         
	            lastTabCount3 = currentTabCount3;
	           
						}

						//grunt.log.writeln(newStylus3);
						return newStylus3;
					}
				  
					var scss = convertStylScss(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, scss);

					if(scss != ''){
						grunt.verbose.writeln('File ' + chalk.cyan(destFile) + ' created.');
					}
		  	}
		  }
    }, done);
  });

	var compileStylus = function(srcFile, options, callback) {
    options = _.extend({filename: srcFile}, options);

    // Never compress output in debug mode
    if (grunt.option('debug')) {
      options.compress = false;
    }

    var srcCode = grunt.file.read(srcFile);
    var stylus = require('stylus');
    var s = stylus(srcCode);

    if ( options.rawDefine ) {
      // convert string option to an array with single value.
      if ( _.isString( options.rawDefine ) ) {
        options.rawDefine = [options.rawDefine];
      }
    }

    function shouldUseRawDefine(key) {
      if( options.rawDefine === true ) {
        return true;
      } else if ( _.isArray( options.rawDefine ) ) {
        return _.contains(options.rawDefine, key);
      } else {
        return false;
      }
    }

    _.each(options, function(value, key) {
      if (key === 'urlfunc') {
        // Custom name of function for embedding images as Data URI
        if (_.isString(value)) {
          s.define(value, stylus.url());
        } else {
          s.define(value.name, stylus.url({
            limit: value.limit != null ? value.limit : 30000,
            paths: value.paths ? value.paths : []
          }));
        }
      } else if (key === 'use') {
        value.forEach(function(func) {
          if (_.isFunction(func)) {
            s.use(func());
          }
        });
      } else if (key === 'define') {
        for (var defineName in value) {
          s.define(defineName, value[defineName], shouldUseRawDefine(defineName));
        }
      } else if (key === 'rawDefine') {
        // do nothing.
      } else if (key === 'import') {
        value.forEach(function(stylusModule) {
          s.import(stylusModule);
        });
      } else if (key === 'resolve url') {
        s.define('url', stylus.resolver());
      } else {
        s.set(key, value);
      }
    });

    // Load Nib if available
    try {
      s.use(require('nib')());
    } catch (e) {}

    s.render(function(err, css) {
      if (err) {
        grunt.log.error(err);
        grunt.fail.warn('Stylus failed to compile.');
      }
      callback(css, err ? err : false);
    });
  }

  var convertSCSS = function(srcFile, options, callback) {
    options = _.assign({filename: srcFile}, options);
    options.paths = options.paths || [path.dirname(srcFile)];

    if (typeof options.paths === 'function') {
      try {
        options.paths = options.paths(srcFile);
      } catch (e) {
        grunt.fail.warn(wrapError(e, 'Generating @import paths failed.'));
      }
    }


    var css,
    less,
    srcCode = grunt.file.read(srcFile);

      try {
        less = convert(srcCode);
        callback(less, null);
      } catch (e) {
        scss2lessError(e, srcFile);
        callback(less, true);
      }
   
  };
  var scss2lessError = function(e, file) {
    var message = 'error';

    grunt.log.error(message);
    grunt.fail.warn('365 Error compiling ' + file);
  };
  
  var convert = function (source) {
    source = source.replace(/@mixin /g,'.');
    source = source.replace(/@include /g,'.');
    source = source.replace(/\$(\w+)/g,"@$1");
    source = source.replace(/@extend ([\w\-\.]+);/g,"&:extend( $1 );");
    source = source.replace(/ !default/g,'');
    source = source.replace(/#{([^}]+)}/g,"~\"$1\"");
    source = source.replace(/~\"@(\w+)\"/g,"@{$1}");
    source = source.replace(/adjust-hue\(/g,'spin(');
    
    source = source.replace(/(@if)([^{]+)({)/g,function(match,m1,m2,m3){ 
		var result = '& when';
			result += m2.replace(/==/g,'=');
			result += m3;
			return result;
		});
	  return source;
  };

  var writeFile = function (path, output) {
    if (output.length < 1) {
      warnOnEmptyFile(path);
    } else {
      grunt.file.write(path, output);
      grunt.log.writeln('File ' + path + ' created.');
    }
  };

  var warnOnEmptyFile = function (path) {
    grunt.log.warn('Destination (' + path + ') not written because compiled files were empty.');
  };

  var compileLess = function(srcFile, destFile, options) {
    options = _.assign({filename: srcFile}, options);
    options.paths = options.paths || [path.dirname(srcFile)];

    if (_.isFunction(options.paths)) {
      try {
        options.paths = options.paths(srcFile);
      } catch (e) {
        grunt.fail.warn(wrapError(e, 'Generating @import paths failed.'));
      }
    }

    if (options.sourceMap && !options.sourceMapFileInline && !options.sourceMapFilename) {
      options.sourceMapFilename = destFile + '.map';
    }

    if (_.isFunction(options.sourceMapBasepath)) {
      try {
        options.sourceMapBasepath = options.sourceMapBasepath(srcFile);
      } catch (e) {
        grunt.fail.warn(wrapError(e, 'Generating sourceMapBasepath failed.'));
      }
    }

    if (_.isBoolean(options.sourceMap) && options.sourceMap) {
      options.sourceMap = {
        sourceMapBasepath: options.sourceMapBasepath,
        sourceMapFilename: options.sourceMapFilename,
        sourceMapInputFilename: options.sourceMapInputFilename,
        sourceMapFullFilename: options.sourceMapFullFilename,
        sourceMapURL: options.sourceMapURL,
        sourceMapRootpath: options.sourceMapRootpath,
        outputSourceFiles: options.outputSourceFiles,
        sourceMapFileInline: options.sourceMapFileInline
      };
    }

    var srcCode = grunt.file.read(srcFile);

    // Equivalent to --modify-vars option.
    // Properties under options.modifyVars are appended as less variables
    // to override global variables.
    var modifyVarsOutput = parseVariableOptions(options['modifyVars']);
    if (modifyVarsOutput) {
      srcCode += '\n';
      srcCode += modifyVarsOutput;
    }

    // Load custom functions
    if (options.customFunctions) {
      Object.keys(options.customFunctions).forEach(function(name) {
        less.functions.functionRegistry.add(name.toLowerCase(), function() {
          var args = [].slice.call(arguments);
          args.unshift(less);
          var res = options.customFunctions[name].apply(this, args);
            return _.isObject(res) ? res : new less.tree.Anonymous(res);
        });
      });
    }

    return less.render(srcCode, options)
      .catch(function(err) {
        lessError(err, srcFile);
      });
  };

  var parseVariableOptions = function(options) {
    var pairs = _.pairs(options);
    var output = '';
    pairs.forEach(function(pair) {
      output += '@' + pair[0] + ':' + pair[1] + ';';
    });
    return output;
  };

  var formatLessError = function(e) {
    var pos = '[' + 'L' + e.line + ':' + ('C' + e.column) + ']';
    return e.filename + ': ' + pos + ' ' + e.message;
  };

  var lessError = function(e, file) {
    var message = less.formatError ? less.formatError(e) : formatLessError(e);

    grunt.log.error(message);
    grunt.fail.warn('626 Error compiling ' + file);
  };

  var wrapError = function (e, message) {
    var err = new Error(message);
    err.origError = e;
    return err;
  };
}

