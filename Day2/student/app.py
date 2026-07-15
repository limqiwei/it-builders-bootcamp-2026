# This is an import statement. 
# Flask is a library that we can use on our server computer to serve files.
from flask import Flask, request, render_template, url_for

app = Flask(__name__)

# ----------------------------
# 1. Understand what is route
# 2. Understand what does "/" mean when set in the function.
# ----------------------------
@app.route("/")
def welcome():
	# This function hello() returns a string when the route / is called.
	# Try changing the text here
	# This is text input
	return "Hello! You are running your first server using Flask."

# ----------------------------
# Try going to /welcome route in your browser. 
# What is the difference between "/" and "/welcome"
# What are the things that look the same?
# What does .html mean?
# What other files we need to know today? .css and .js (Show HTML, CSS, JS)
# ----------------------------
@app.route("/welcome")
def welcomeWithStyle():
	return render_template('welcome.html')

# More routes
@app.route("/about")
def about():
	return "<h1>This is content served from a flask server. Welcome to IT Builder Bootcamp!</h1>"

@app.route("/landing")
def landing():
	return render_template('home/index.html')

# Adding a route

# Follow the Teacher: "Creating a /home" page

# Task: Create a page at "/hello" and add a short self introduction.
# Hint: Copy and paste a working route, then adjust from there. 



# This is a very important part
if __name__ == '__main__':
	app.run(host='0.0.0.0', port=8000, debug=True)
	