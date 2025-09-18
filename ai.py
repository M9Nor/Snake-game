# ai.py — simple autopilot for Snake using greedy movement
# Returns [dx, dy] toward the food while avoiding immediate reversal.
def next_dir(hx, hy, fx, fy, dx, dy):
    # Prefer the axis with larger distance
    vx = 0; vy = 0
    if abs(fx - hx) > abs(fy - hy):
        vx = 1 if fx > hx else -1 if fx < hx else 0
    else:
        vy = 1 if fy > hy else -1 if fy < hy else 0
    # Avoid immediate reverse
    if vx == -dx and vy == -dy:
        if vx != 0: 
            vy = 1 if fy >= hy else -1
            vx = 0
        else:
            vx = 1 if fx >= hx else -1
            vy = 0
    return [vx, vy]
