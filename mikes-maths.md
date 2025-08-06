### Prove that \\(\sqrt{2}\\) is irrational

We begin by assuming that opposite is true and that \\(\sqrt{2}\\) is rational.
Therefore we can say that \\(\sqrt{2} = \frac{p}{q}\\) where \\(p\\) and \\(q\\) are integers and [coprime](https://en.wikipedia.org/wiki/Coprime_integers).
This can be re-written as

$$
p ^ 2 = 2 q ^ 2
$$

which means that \\(p ^ 2\\) is even
[and hence \\(p\\) is also even](https://math.stackexchange.com/questions/2708654/if-the-square-of-an-integer-number-x-is-even-then-x-has-to-be-even/2708668#2708668).
This allows us to write \\(p = 2k\\) where \\(k\\) is an integer.
If we plug this back into the original equation and re-write we get

$$
q ^ 2 = 2 k ^ 2
$$

which means that \\(q\\) is also even.
However our \\(p\\) and \\(q\\) can't both be even and coprime so our assumption is false and \\(\sqrt{2}\\) must be irrational.

### Prove that the Product of 2 Odd Numbers is Odd

We define an odd number as \\(2n+1\\) where \\(n\\) is an integer.
Therefore we can express the product of 2 odd numbers as

$$
(2a+1)(2b+1)
$$

where \\(a\\) and \\(b\\) are integers. Now we expand the brackets and re-arrange the terms a little we get

$$
2(2ab + a + b) + 1
$$

One of the properties of the addition operation on the integers (and hence also multiplication) is that it is a closed operation, ie. it's result is also an integer. So the result of the brackets must be an integer and therefore we have demonstrated that our result must be an odd number. 

### Solve for the Shaded Area

![Solve for the Shaded Area](https://mindyourdecisions.com/blog/wp-content/uploads/2018/06/Find-The-Area-You-Should-Be-Able-To-Solve-problem.png)

The trick is to draw 4 lines from the corners to the central point and then reason about the areas of the resulting triangles.

### Proof of the Power Rule for Logarithms

Prove that \\(log_ax^n = nlog_ax\\)

$$
\textrm{Let} \: m=log_ax
$$

In exponent form this is

$$
a^m = x
$$

Now raise both sides to \\(n\\)

$$
a^{mn} = x^n
$$

.. and take the log

$$
mn = log_a x^n
$$

We note that, by definition, the LHS is simply \\(mn\\). Now substitute \\(m\\) and we have the result.

### Logarithm Notes

\\(log_b x\\) is how many \\(b\\)'s do we need to multiply together to get \\(x\\)

- Where `b` isn't given `log` is typically a "common" logarithm `(b = 10)`. and `ln` is a "natural" logarithm `(b = e)`.
- Logarithms can be used to solve for an exponent.

#### Rules of Logarithms:

![Rules of Logarithms](https://www.chilimath.com/wp-content/uploads/2020/03/log-rules.gif)

[Logarithms Practice](https://madasmaths.com/archive/maths_booklets/basic_topics/various/logarithms_practice.pdf)

### Proof that ..

$$
cos(\theta)^2+sin(\theta)^2=1
$$

We know that

$$
cos(\theta) = \frac{Adjacent}{Hypotenuse} \quad \textrm{and} \quad sin(\theta) = \frac{Opposite}{Hypotenuse}
$$

So we can rewrite as

$$
\Big(\frac{Adjacent}{Hypotenuse}\Big)^2 + \Big(\frac{Opposite}{Hypotenuse}\Big)^2
$$

.. and again as

$$
\frac{Adjacent^2 + Opposite^2}{Hypotenuse^2}
$$

.. so it's obvious that, due to Pythagoras Theorem, this expression evaluates to `1`.

### The Sine-Cosine Graph

To reproduce, remember that the sine wave intersects (0, 0) and cosine wave intersects (0, 1).

![Sine-Cosine Graph](https://www.mathsisfun.com/algebra/images/sine-cosine-graph.svg)

### Proof of Pythagoras Theorem

Draw a square then draw a smaller square inside the first square such that the inner square's corners are braced against the outer square. This gives 4 equal right-angled triangles. Denote their opposite, adjacent and hypotenuse with `a`, `b` and `c`, resp.

![2 Squares](https://graphicmaths.com/img/gcse/trigonometry/pythagoras/pythagoras-proof-visual-1.png)

The outer square's area can then be given by both the square of it's sides and the sum of the triangles and inner square which leads to the following expression:

$$
(a + b)^2 = 2ab + c^2
$$

This can be reduced quite easily to

$$
a^2 + b^2 = c^2
$$

### Differentiation from 1st Principles

$$
f'(x) = \lim_{h\to 0}\frac{f(x+h)-f(x)}{h}
$$

### References

- [Latex Cheat Sheet](https://tug.ctan.org/info/undergradmath/undergradmath.pdf)