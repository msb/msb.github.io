---
title: Random bits of maths
format_maths: true
---

### Deriving the formula for a geometric series.

A **sequence** is an ordered list of number: $a_1, a_2, a_3, ..$

A **series** is the sum of the terms of a sequence: $a_1 + a_2 + a_3 + ..$

A **geometric sequence** (or progression) is a sequence of numbers where each term (after the 1st) is derived by multiplying the previous one with a fixed, non-zero number call a **common ratio**.

If we express a **geometric series** with $n$ terms as follows ..

$$
S_n = a_1 + a_2 + a_3 + .. + a_n
$$

.. where it's common ratio is $r$ then we can rewrite the expression as follows:

$$
S_n = a_1 + r a_1 + r^2 a_1 + .. + r^{n-1} a_n
$$

As a step towards deriving a formula, we'll multiply both sides of the expression by $r$

$$
r S_n = r a_1 + r^2 a_1 + r^3 a_1 + .. + r^n a_n
$$

Now if we subtract the 2nd expression from the 1st we note that all terms on the RHS cancel out apart from $a_1$ and $r^n a_n$ and so we are left with ..

$$
S_n - r S_n = a_1 + r^n a_n
$$

.. which can be re-arranged as ..

$$
S_n = \frac{a_1 (1 - r^n)}{1 - r}
$$

.. and so we have derived a formula for calculating a geometric series of arbitrary length $n$.
We can look at what happens when we allow $n$ to approach infinity. 
If $r \geq |1|$ then the formula shoots off to infinity. However, if $r < |1|$ then we get the following result:

$$
\lim_{n \to \infty} S_n = \frac{a_1 (1 - 0)}{1 - r} = \frac{a_1}{1 - r}
$$

### Simplist inductive proof: $\sum_{j=0}^n j = \frac{n(n+1)}{2}$ where $n$ is a whole number.

If $n=1$ then clearly the above statement is true (the **base case**).

Now we assume that the above statement is true for $n=k$ (the **inductive hypothesis**) ..

$$
\sum_{j=0}^k j = \frac{k(k+1)}{2}
$$

.. and try to prove the statement for $n=k+1$ (the **inductive step**) ..

$$
\sum_{j=0}^{k+1} j = \frac{(k+1)(k+2)}{2}
$$

The LHS can be written as

$$
\sum_{j=0}^k j + (k+1)
$$

and again as

$$
\frac{k(k+1)}{2} + (k+1)
$$

Factor out $(k+1)$:

$$
(k+1)(\frac{k}{2} + 1)
$$

.. and simplify

$$
\frac{(k+1)(k+2)}{2}
$$

.. which is the RHS so we have proved the inductive step.

[Proof by induction exercises](https://madasmaths.com/archive/maths_booklets/further_topics/various/proof_by_induction.pdf)

### Prove that $\sqrt{2}$ is irrational

We begin by assuming that opposite is true and that $\sqrt{2}$ is rational.
Therefore we can say that $\sqrt{2} = \frac{p}{q}$ where $p$ and $q$ are integers and [coprime](https://en.wikipedia.org/wiki/Coprime_integers).
This can be re-written as

$$
p ^ 2 = 2 q ^ 2
$$

which means that $p ^ 2$ is even
[and hence $p$ is also even](https://math.stackexchange.com/questions/2708654/if-the-square-of-an-integer-number-x-is-even-then-x-has-to-be-even/2708668#2708668).
This allows us to write $p = 2k$ where $k$ is an integer.
If we plug this back into the original equation and re-write we get

$$
q ^ 2 = 2 k ^ 2
$$

which means that $q$ is also even.
However our $p$ and $q$ can't both be even and coprime so our assumption is false and $\sqrt{2}$ must be irrational.

### Prove that the Product of 2 Odd Numbers is Odd

We define an odd number as $2n+1$ where $n$ is an integer.
Therefore we can express the product of 2 odd numbers as

$$
(2a+1)(2b+1)
$$

where $a$ and $b$ are integers. Now we expand the brackets and re-arrange the terms a little we get

$$
2(2ab + a + b) + 1
$$

One of the properties of the addition operation on the integers (and hence also multiplication) is that it is a closed operation, ie. it's result is also an integer. So the result of the brackets must be an integer and therefore we have demonstrated that our result must be an odd number. 

### Solve for the Shaded Area

![Solve for the Shaded Area](https://mindyourdecisions.com/blog/wp-content/uploads/2018/06/Find-The-Area-You-Should-Be-Able-To-Solve-problem.png)

The trick is to draw 4 lines from the corners to the central point and then reason about the areas of the resulting triangles.

### Proof of the Power Rule for Logarithms

Prove that $log_ax^n = nlog_ax$

$$
\textrm{Let} \: m=log_ax
$$

In exponent form this is

$$
a^m = x
$$

Now raise both sides to $n$

$$
a^{mn} = x^n
$$

.. and take the log

$$
mn = log_a x^n
$$

We note that, by definition, the LHS is simply $mn$. Now substitute $m$ and we have the result.

### Logarithm Notes

$log_b x$ is how many $b$'s do we need to multiply together to get $x$

- Where `b` isn't given `log` is typically a "common" logarithm `(b = 10)`. and `ln` is a "natural" logarithm `(b = e)`.
- Logarithms can be used to solve for an exponent.

#### Rules of Logarithms:

![Rules of Logarithms](https://www.chilimath.com/wp-content/uploads/2020/03/log-rules.gif)

(we note that rules 2 & 3 are corollaries of rule 1)

[Logarithm Exercises](https://madasmaths.com/archive/maths_booklets/basic_topics/various/logarithms_practice.pdf)

### Proving that $cos(\theta)^2+sin(\theta)^2=1$

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

[](https://madasmaths.com/archive/maths_booklets/further_topics/various/differentiation_from_first_principles.pdf)

### References

- [Latex Cheat Sheet](https://tug.ctan.org/info/undergradmath/undergradmath.pdf)