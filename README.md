### Prove that the Product of 2 Odd Numbers is Odd

We define an odd number as

```math
2n+1 \quad \textrm{where n is an integer}
```

So we can express the product of 2 odd numbers as

```math
(2a+1)(2b+1) \quad \textrm{where a \& b are integers}
```

Now we expand the brackets and re-arrange the terms a little we get

```math
2(2ab + a + b) + 1
```

One of the properties of the addition operation on the integers (and hence also multiplication) is that it is a closed operation, ie. it's result is also an integer. So the result of the brackets must be an integer and therefore we have demonstrated that our result must be an odd number. 

### Solve for the Shaded Area

![Solve for the Shaded Area](https://mindyourdecisions.com/blog/wp-content/uploads/2018/06/Find-The-Area-You-Should-Be-Able-To-Solve-problem.png)

The trick is to draw 4 lines from the corners to the central point and then reason about the areas of the resulting triangles.

### Proof of the Power Rule for Logarithms

```math
\textrm{Prove that} \quad log_ax^n = nlog_ax
```

```math
\textrm{Let} \: m=log_ax
```

In exponent form this is

```math
a^m = x
```

Now raise both sides to `n`

```math
a^{mn} = x^n
```

.. and take the log

```math
mn = log_a x^n
```

We note that, by definition, the LHS is simply `mn`. Now substitute `m` and we have the result.

### Logarithm Notes

```math
log_b x \quad \textrm{how many b's do we need to multiply together to get x}
```

- Where `b` isn't given `log` is typically a "common" logarithm `(b = 10)`. and `ln` is a "natural" logarithm `(b = e)`.
- Logarithms can be used to solve for an exponent.

#### Rules of Logarithms:

![Rules of Logarithms](https://www.chilimath.com/wp-content/uploads/2020/03/log-rules.gif)

[Logarithms Practice](https://madasmaths.com/archive/maths_booklets/basic_topics/various/logarithms_practice.pdf)

### Proof that ..

```math
cos(\theta)^2+sin(\theta)^2=1
```

We know that

```math
cos(\theta) = \frac{Adjacent}{Hypotenuse} \quad \textrm{and} \quad sin(\theta) = \frac{Opposite}{Hypotenuse}
```

So we can rewrite as

```math
\Big(\frac{Adjacent}{Hypotenuse}\Big)^2 + \Big(\frac{Opposite}{Hypotenuse}\Big)^2
```

.. and again as

```math
\frac{Adjacent^2 + Opposite^2}{Hypotenuse^2}
```

.. so it's obvious that, due to Pythagoras Theorem, this expression evaluates to `1`.

### The Sine-Cosine Graph

To reproduce, remember that the sine wave intersects (0, 0) and cosine wave intersects (0, 1).

![Sine-Cosine Graph](https://www.mathsisfun.com/algebra/images/sine-cosine-graph.svg)

### Proof of Pythagoras Theorem

Draw a square then draw a smaller square inside the first square such that the inner square's corners are braced against the outer square. This gives 4 equal right-angled triangles. Denote their opposite, adjacent and hypotenuse with `a`, `b` and `c`, resp.

![2 Squares](https://graphicmaths.com/img/gcse/trigonometry/pythagoras/pythagoras-proof-visual-1.png)

The outer square's area can then be given by both the square of it's sides and the sum of the triangles and inner square which leads to the following expression:

```math
(a + b)^2 = 2ab + c^2
```

This can be reduced quite easily to

```math
a^2 + b^2 = c^2
```

### Differentiation from 1st Principles

```math
f'(x) = \lim_{h\to 0}\frac{f(x+h)-f(x)}{h}
```

### References

- [Latex Cheat Sheet](https://tug.ctan.org/info/undergradmath/undergradmath.pdf)