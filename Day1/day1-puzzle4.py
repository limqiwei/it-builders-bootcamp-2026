# Python Day 1 Puzzle 4

num = int(input("countdown size:"))

for count in range(num, -1, -1):
    if count == 0:
        print("BLASTOFF!!!!")
    elif count == 20:
        print("Launch Director, Final checks completed. Ready for launch")
    elif count%10==0:
        print(f"Launch Director, the time is at T-minus {count} seconds")
    elif count%7==0:
        print(f"{count} Additional checks in progress. Looking good.")
    else:
        print(count)

print("Tada")