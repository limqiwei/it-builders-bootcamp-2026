# This is an import statement. 
# Flask is a library that we can use on our server computer to serve files.
from flask import Flask, request, jsonify, render_template, url_for
import os
import json

SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data/")
SAVE_PATH = os.path.join(SAVE_DIR, "family_tree.json")

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

# Adding a route

# Follow the Teacher: "Creating a /home" page

# Task: Create a page at "/hello" and add a short self introduction.
# Hint: Copy and paste a working route, then adjust from there. 

# -------------- TEACHER EXAMPLES (START) --------------
# These below can be hidden from kids. So they would not have a base template to start.
# Base: Copy resources/empty_page.html

@app.route("/landing")
def landing():
	return render('home/index.html')

@app.route("/examples/")
def examples():
	return render('examples/index.html')

# This is a standard form. POST and GET are important concepts for web hosting.
# May spend the most time here.
# Form submission is quite powerful.
@app.route("/examples/sum-it-up", methods=['GET', 'POST'])
def sumItUp():
	if (request.method == 'POST'):
		first = request.form['first'] 
		second = request.form['second']
		total = int(first) + int(second)
		return render('examples/sum_it_up/result.html', first=first, second=second, total=total)
	else:
		return render('examples/sum_it_up/index.html')

# This is a slider section to demonstrate Javascript.
@app.route("/examples/mood-slider")
def makeYourRange():
	return render('examples/mood_slider/index.html')

# This is a color slider section to introduce colors.
@app.route("/examples/hidden-message")
def hiddenMessage():
	return render('examples/hidden_message/index.html')

# This is a game where user should tap up till 30.
# This is advanced
@app.route("/examples/tap-to-thirty")
def thirtyTapper():
	return render('examples/tap_to_thirty/index.html')

# This is a reusable function. Other functions can call this.
# Teach refactoring here
def render(content, **params):
	return render_template('layouts/main.html', content_template=content, **params)

# -------------- TEACHER EXAMPLES (END) --------------

@app.route("/familyTree")
def familyTree():
	nodes = []
	if os.path.exists(SAVE_PATH):
		try:
			with open(SAVE_PATH, 'r', encoding='utf-8') as f:
				nodes = json.load(f)
		except (json.JSONDecodeError, OSError) as e:
			app.logger.error(f"Failed to load family tree JSON: {e}")
			nodes = []
	return render('family_tree/index.html', nodes=nodes)


@app.route("/familyTree/save", methods=['POST'])
def saveFamilyTree():
	try:
		data = request.get_json()
		with open(SAVE_PATH, 'w', encoding='utf-8') as f:
			json.dump(data, f, indent=2, ensure_ascii=False)
			return jsonify(success=True, path=SAVE_PATH)
	except Exception as e:
		return jsonify(success=False, error=str(e))

# This is a very important part
if __name__ == '__main__':
	app.run(host='0.0.0.0', port=8001, debug=True)
	