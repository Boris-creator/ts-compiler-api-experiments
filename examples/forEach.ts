const arr = [1, 2, 3];
arr.forEach((el, i) => {
    if (el > 0) {
        return
    }
    function f(x: number) {
        return x + 1
    }
    console.log(f(el))
})
function log (x: number, index: number, arr: number[]) {}
arr.forEach(log)
