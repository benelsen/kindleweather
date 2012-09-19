#!/bin/sh

cd "$(dirname "$0")"

node kindleweather.js

# convert the svg to png 
rsvg-convert -o kindleweather-output.png kindleweather-output.svg

# # # 
# # as an alternative you can use svg2png (didn't look as good as librsvg to me)
# svg2png kindleweather-output.svg kindleweather-output.png

pngcrush -q -c 0 -ow kindleweather-output.png

# # # 
# # if pngcrush < 1.7.22 use the following two lines:
# pngcrush -q -c 0 kindleweather-output.png kindleweather-output-1.png
# mv kindleweather-output-1.png kindleweather-output.png

cp -f kindleweather-output.png ~/html/kindleweather/kindleweather-output.png

# # clean
# rm kindleweather-output*
