# Python Day 1 Puzzle 3 Loops

# Question 1
num = int(input("square size:"))

for height in range(0,num):
    print("*" * num);

print("Tada")

# Question 2
passcode = 20
answer = None
while answer != passcode:
    answer = int(input("Guess a Number:"))
    if answer == passcode:
        print("correct answer")
        break
    elif answer > passcode:
        print("lower")
    else:
        print("higher")

print(f"You are right the answer is {answer}!")