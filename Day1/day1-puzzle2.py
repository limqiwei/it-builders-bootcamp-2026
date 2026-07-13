# Python Day 1 Puzzle 2 Input & Control Statements

school = input('What school do I attend')
if school == "graduated":
    print("You are right, I have graduated University!")
else:
    print("Try again another time")

money = int(input('How much Students are in this class?'))
if money < 5:
    print("That seems like too little students")
elif  money > 20:
    print("I think I would have difficulty with that many students")
else:
    print("Seems about right!")

food = input('What is my Favourite food?')
if food == "steak":
    print("Nothin like a medium well ribeye steak")
else:
    print("That's not quite right")

print("Thank you for playing!")
