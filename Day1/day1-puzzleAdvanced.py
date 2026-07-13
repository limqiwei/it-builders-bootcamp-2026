# Python Day 1 Advanced Puzzle
# Warning, numbers larger than 25 might slow down your computer

num = int(input("fibonacci  number:"))

def fibonacci (num):
    if(num==1): return 1
    elif(num==2): return 1
    else: return fibonacci(num-1) + fibonacci(num-2)

print(f"fibonacci result {fibonacci (num)}")
