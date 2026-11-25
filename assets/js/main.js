/* MathVizor — поведение сайта (без внешних библиотек) */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initMobileMenu();
    initTaskRecognizer();
  });

  /* Мобильное меню */
  function initMobileMenu() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* Распознавание типа и генерация методики по формуле */
  function initTaskRecognizer() {
    var form = document.getElementById("task-form");
    if (!form) return;
    var result = document.getElementById("task-result");
    var currentInput = { formula: "" };

    var TYPES = {
      structure: {
        title: "1. Распознавание структуры",
        summary: "Определите структуру формулы и свяжите её с видом графика функции.",
        href: "methodology.html#task-structure"
      },
      model: {
        title: "2. Построение модели",
        summary: "Изучите влияние параметров на поведение функции и семейство графиков.",
        href: "methodology.html#task-model"
      },
      explanation: {
        title: "3. Объяснение",
        summary: "Обоснуйте переход от функции к производной и смену знака.",
        href: "methodology.html#task-explanation"
      },
      research: {
        title: "4. Исследовательские",
        summary: "Исследуйте функцию нескольких переменных: частные производные и критические точки.",
        href: "methodology.html#task-research"
      }
    };
    var PRIORITY = ["structure", "model", "explanation", "research"];

    function recognize() {
      var raw = document.getElementById("task-formula").value || "";
      var formula = raw.toLowerCase();
      var parsed = parseExpression(raw);
      var vars = parsed ? parsed.variables : [];
      var params = parsed ? paramsIn(parsed.ast, [], vars) : [];
      var scores = { structure: 0, model: 0, explanation: 0, research: 0 };
      var signals = [];
      function add(type, weight, label) {
        scores[type] += weight;
        if (signals.indexOf(label) === -1) signals.push(label);
      }
      if (/['’`′]|df\/d|dif|deriv|производн|∂/.test(formula)) {
        add("explanation", 5, "в записи указана производная");
      }
      if (vars.length > 1) {
        add("research", 4, "задано несколько переменных: " + vars.join(", "));
      }
      if (params.length) {
        add("model", 3, "в формуле есть параметр: " + params.join(", "));
      }
      if (!scores.explanation && !scores.research && !scores.model) {
        add("structure", 1, "задана формула одной переменной без параметров");
      }
      var best = PRIORITY[0];
      PRIORITY.forEach(function (type) {
        if (scores[type] > scores[best]) best = type;
      });
      if (!signals.length) signals.push("явных признаков не найдено — выбран базовый тип");
      return { type: best, signals: signals };
    }

    function escapeHtml(text) {
      return String(text).replace(/[&<>"']/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
      });
    }

    function options(selected) {
      return PRIORITY.map(function (key) {
        return '<option value="' + key + '"' + (key === selected ? " selected" : "") + ">"
          + escapeHtml(TYPES[key].title) + "</option>";
      }).join("");
    }

    function render(typeKey, signals, manual) {
      var info = TYPES[typeKey];
      var list = manual
        ? "<li>тип выбран вручную</li>"
        : signals.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("");
      plotRegistry = {};
      var methodology = buildMethodology(typeKey, currentInput);
      result.innerHTML =
        '<article class="result-card">'
        + '<p class="result-label">' + (manual ? "Выбранный тип задания" : "Распознанный тип задания") + "</p>"
        + '<h3 id="result-title">' + escapeHtml(info.title) + "</h3>"
        + '<p class="result-summary">' + escapeHtml(info.summary) + "</p>"
        + '<p class="result-caption">Основание:</p>'
        + '<ul class="result-signals">' + list + "</ul>"
        + methodology
        + '<p class="method-link"><a id="result-link" class="btn btn-light" href="' + info.href + '">Общая методика на странице →</a></p>'
        + '<div class="result-override">'
        + '<label for="task-type-select">Другой тип? Выберите вручную:</label>'
        + '<select id="task-type-select">' + options(typeKey) + "</select>"
        + '<button type="button" class="btn btn-light" id="task-type-apply">Показать методику</button>'
        + "</div></article>";
      result.hidden = false;
      attachPlotInteractions();
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("task-type-apply").addEventListener("click", function () {
        render(document.getElementById("task-type-select").value, [], true);
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var formula = document.getElementById("task-formula").value.trim();
      if (!formula) {
        result.innerHTML = '<article class="result-card result-error"><h3>Введите формулу</h3>'
          + "<p>Например: <code>f(x) = x^3 + a*x</code> или <code>f(x,y) = x^2 + y^2</code>.</p></article>";
        result.hidden = false;
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      currentInput = { formula: formula };
      var found = recognize();
      render(found.type, found.signals, false);
    });

    form.addEventListener("reset", function () {
      currentInput = { formula: "" };
      plotRegistry = {};
      result.hidden = true;
      result.innerHTML = "";
    });

    /* ---------- Разбор формулы: токенайзер, AST, вычисление ---------- */

    var SUP = {
      "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
      "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", ".": "·"
    };
    function sup(n) {
      return String(n).split("").map(function (d) { return SUP[d] || d; }).join("");
    }

    var KNOWN_FUNCS = [
      "sin", "cos", "tan", "cot", "sinh", "cosh", "tanh",
      "sqrt", "root", "exp", "ln", "lg", "log", "log10", "log2",
      "abs", "sign", "arcsin", "asin", "arccos", "acos", "arctan", "atan"
    ];
    var FUNC_NUM = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      cot: function (v) { return 1 / Math.tan(v); },
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      sqrt: Math.sqrt,
      root: function (a, b) {
        if (isInteger(b) && Math.abs(b % 2) === 1 && a < 0) return -Math.pow(-a, 1 / b);
        return Math.pow(a, 1 / b);
      },
      exp: Math.exp, ln: Math.log,
      lg: Math.log10, log: Math.log10, log10: Math.log10,
      log2: Math.log2, abs: Math.abs,
      sign: function (v) { return v > 0 ? 1 : v < 0 ? -1 : 0; },
      arcsin: Math.asin, asin: Math.asin,
      arccos: Math.acos, acos: Math.acos,
      arctan: Math.atan, atan: Math.atan
    };

    function num(v) { return { t: "num", v: v }; }
    function mkBin(op, l, r) { return { t: "bin", op: op, l: l, r: r }; }
    function mkNeg(a) { return { t: "neg", a: a }; }
    function mkCall(name, args) { return { t: "call", name: name, args: args }; }
    function isNodeNum(n, v) { return !!n && n.t === "num" && Math.abs(n.v - v) < 1e-12; }
    function isZero(n) { return isNodeNum(n, 0); }
    function isOne(n) { return isNodeNum(n, 1); }
    function isInteger(v) { return Math.abs(v - Math.round(v)) < 1e-10; }
    function roundTo(v, digits) {
      var k = Math.pow(10, digits === undefined ? 2 : digits);
      return Math.round(v * k) / k;
    }
    function fmtNum(v, digits) {
      if (!isFinite(v)) return "—";
      if (Math.abs(v) < 1e-10) v = 0;
      var r = roundTo(v, digits === undefined ? 2 : digits);
      return String(r).replace("-", "−");
    }

    function normalizeFormula(raw) {
      var s = String(raw || "").toLowerCase()
        .replace(/[−–—]/g, "-")
        .replace(/[∗·∙×]/g, "*")
        .replace(/[′’`]/g, "'")
        .replace(/х/g, "x")
        .replace(/π/g, "pi")
        .replace(/√/g, "sqrt")
        .replace(/∂/g, "d")
        .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function (d) { return "^" + "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(d); })
        .replace(/\*\*/g, "^")
        .replace(/\s+/g, "");
      var variables = ["x"], isDerivative = false, decl;
      decl = s.match(/^(?:f|g|h|z|w|u|v)'?\(([a-z](?:,[a-z])*)\)=/);
      if (decl) {
        variables = decl[1].split(",");
        isDerivative = decl[0].indexOf("'") !== -1;
        s = s.slice(decl[0].length);
      } else {
        decl = s.match(/^d(?:f|g|h|z|w|u|v)?\/d([a-z])=/);
        if (decl) {
          variables = [decl[1]];
          isDerivative = true;
          s = s.slice(decl[0].length);
        } else {
          s = s.replace(/^(?:f|g|h|z|w|u|v)\(x\)=/, "").replace(/^[a-z]=/, "");
        }
      }
      return { s: s, variables: variables, isDerivative: isDerivative };
    }

    function tokenize(s) {
      var tokens = [], i = 0;
      while (i < s.length) {
        var ch = s.charAt(i), m;
        if (/[0-9.]/.test(ch)) {
          m = s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
          if (!m) return null;
          tokens.push({ type: "num", value: parseFloat(m[0]) });
          i += m[0].length;
        } else if (/[a-z]/.test(ch)) {
          m = s.slice(i).match(/^[a-z]+/);
          tokens.push({ type: "ident", value: m[0] });
          i += m[0].length;
        } else if ("+-*/^(),".indexOf(ch) !== -1) {
          tokens.push({ type: "op", value: ch });
          i++;
        } else {
          return null;
        }
      }
      return tokens;
    }

    function Parser(tokens) { this.tokens = tokens; this.pos = 0; }
    Parser.prototype.peek = function () { return this.tokens[this.pos] || null; };
    Parser.prototype.next = function () { return this.tokens[this.pos++] || null; };
    Parser.prototype.expect = function (v) {
      var t = this.next();
      if (!t || t.value !== v) throw new Error("ожидалось " + v);
      return t;
    };
    Parser.prototype.isAtomStart = function () {
      var t = this.peek();
      return !!t && (t.type === "num" || t.type === "ident" || (t.type === "op" && t.value === "("));
    };
    Parser.prototype.parseExpr = function () {
      var node = this.parseTerm(), t;
      while (t = this.peek(), t && t.type === "op" && (t.value === "+" || t.value === "-")) {
        this.next();
        node = mkBin(t.value, node, this.parseTerm());
      }
      return node;
    };
    Parser.prototype.parseTerm = function () {
      var node = this.parseUnary(), t;
      while (t = this.peek(), t && t.type === "op" && (t.value === "*" || t.value === "/")) {
        this.next();
        node = mkBin(t.value, node, this.parseUnary());
      }
      return node;
    };
    Parser.prototype.parseUnary = function () {
      var t = this.peek();
      if (t && t.type === "op" && (t.value === "+" || t.value === "-")) {
        this.next();
        var a = this.parseUnary();
        return t.value === "-" ? mkNeg(a) : a;
      }
      return this.parsePower();
    };
    Parser.prototype.parsePower = function () {
      var base = this.parsePrimary(), t = this.peek();
      if (t && t.type === "op" && t.value === "^") {
        this.next();
        return mkBin("^", base, this.parseUnary());
      }
      return base;
    };
    Parser.prototype.parsePrimary = function () {
      var node = this.parseAtom();
      while (this.isAtomStart()) node = mkBin("*", node, this.parseAtomPower());
      return node;
    };
    Parser.prototype.parseAtomPower = function () {
      var base = this.parseAtom(), t = this.peek();
      if (t && t.type === "op" && t.value === "^") {
        this.next();
        return mkBin("^", base, this.parseUnary());
      }
      return base;
    };
    Parser.prototype.parseAtom = function () {
      var t = this.next(), next, args, name;
      if (!t) throw new Error("незавершённая формула");
      if (t.type === "num") return num(t.value);
      if (t.type === "op" && t.value === "(") {
        var inner = this.parseExpr();
        this.expect(")");
        return inner;
      }
      if (t.type === "ident") {
        name = t.value;
        next = this.peek();
        if (next && next.type === "op" && next.value === "(") {
          this.next();
          args = [];
          if (!(this.peek() && this.peek().value === ")")) {
            args.push(this.parseExpr());
            while (this.peek() && this.peek().value === ",") {
              this.next();
              args.push(this.parseExpr());
            }
          }
          this.expect(")");
          return mkCall(name, args);
        }
        if (name === "pi" || name === "e") return num(name === "pi" ? Math.PI : Math.E);
        return { t: "var", name: name };
      }
      throw new Error("неожидаемый символ: " + t.value);
    };

    function findUnknownFunctions(n, bad) {
      bad = bad || [];
      if (!n) return bad;
      if (n.t === "call" && KNOWN_FUNCS.indexOf(n.name) === -1 && bad.indexOf(n.name) === -1) bad.push(n.name);
      if (n.t === "bin") { findUnknownFunctions(n.l, bad); findUnknownFunctions(n.r, bad); }
      if (n.t === "neg") findUnknownFunctions(n.a, bad);
      if (n.t === "call") n.args.forEach(function (a) { findUnknownFunctions(a, bad); });
      return bad;
    }

    function parseExpression(raw) {
      var norm = normalizeFormula(raw);
      if (!norm.s) return null;
      try {
        var tokens = tokenize(norm.s);
        if (!tokens || !tokens.length) return null;
        var p = new Parser(tokens);
        var ast = p.parseExpr();
        if (p.peek() || !ast || findUnknownFunctions(ast, []).length) return null;
        return { ast: ast, source: norm.s, variables: norm.variables, isDerivative: norm.isDerivative };
      } catch (e) {
        return null;
      }
    }

    function evalBin(op, a, b) {
      switch (op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "^": return Math.pow(a, b);
      }
      return NaN;
    }
    function callFunc(name, a) {
      var f = FUNC_NUM[name];
      if (!f) return NaN;
      if (name === "log" && a.length > 1) return Math.log(a[0]) / Math.log(a[1]);
      if (name === "root" && a.length < 2) return Math.sqrt(a[0]);
      return f.apply(null, a);
    }
    function evalNode(n, values, params) {
      if (!n) return NaN;
      switch (n.t) {
        case "num": return n.v;
        case "var":
          if (values && values[n.name] !== undefined) return values[n.name];
          return params && params[n.name] !== undefined ? params[n.name] : 1;
        case "neg": return -evalNode(n.a, values, params);
        case "bin": return evalBin(n.op, evalNode(n.l, values, params), evalNode(n.r, values, params));
        case "call": return callFunc(n.name, n.args.map(function (a) { return evalNode(a, values, params); }));
      }
      return NaN;
    }
    function dependsOn(n, name) {
      if (!n) return false;
      if (n.t === "var") return n.name === name;
      if (n.t === "neg") return dependsOn(n.a, name);
      if (n.t === "bin") return dependsOn(n.l, name) || dependsOn(n.r, name);
      if (n.t === "call") return n.args.some(function (a) { return dependsOn(a, name); });
      return false;
    }
    function paramsIn(n, list, variables) {
      list = list || [];
      variables = variables || ["x"];
      if (!n) return list;
      if (n.t === "var" && variables.indexOf(n.name) === -1 && list.indexOf(n.name) === -1) list.push(n.name);
      if (n.t === "bin") { paramsIn(n.l, list, variables); paramsIn(n.r, list, variables); }
      if (n.t === "neg") paramsIn(n.a, list, variables);
      if (n.t === "call") n.args.forEach(function (a) { paramsIn(a, list, variables); });
      return list;
    }

    /* ---------- Символьное дифференцирование по выбранной переменной ---------- */

    function simplify(n) {
      if (!n) return n;
      if (n.t === "neg") {
        var a = simplify(n.a);
        if (a.t === "num") return num(-a.v);
        if (a.t === "neg") return a.a;
        return mkNeg(a);
      }
      if (n.t === "call") {
        var args = n.args.map(simplify);
        if (args.every(function (v) { return v.t === "num"; }) && FUNC_NUM[n.name]) {
          var fv = callFunc(n.name, args.map(function (v) { return v.v; }));
          if (isFinite(fv)) return num(fv);
        }
        return mkCall(n.name, args);
      }
      if (n.t === "bin") {
        var l = simplify(n.l), r = simplify(n.r), op = n.op;
        if (l.t === "num" && r.t === "num") {
          var v = evalBin(op, l.v, r.v);
          if (isFinite(v)) return num(v);
        }
        if (op === "+") { if (isZero(l)) return r; if (isZero(r)) return l; }
        if (op === "-") { if (isZero(r)) return l; if (isZero(l)) return mkNeg(r); }
        if (op === "*") {
          if (isZero(l) || isZero(r)) return num(0);
          if (isOne(l)) return r;
          if (isOne(r)) return l;
          if (l.t === "num" && r.t === "bin" && r.op === "*" && r.l.t === "num") return mkBin("*", num(l.v * r.l.v), r.r);
          if (r.t === "num" && l.t === "bin" && l.op === "*" && l.l.t === "num") return mkBin("*", num(r.v * l.l.v), l.r);
          if (l.t === "num" && r.t === "neg" && r.a.t === "num") return num(-l.v * r.a.v);
          if (r.t === "num" && l.t === "neg" && l.a.t === "num") return num(-r.v * l.a.v);
        }
        if (op === "/") { if (isZero(l)) return num(0); if (isOne(r)) return l; }
        if (op === "^") {
          if (isZero(r)) return num(1);
          if (isOne(r)) return l;
          if (isZero(l) && r.t === "num" && r.v > 0) return num(0);
        }
        return mkBin(op, l, r);
      }
      return n;
    }

    function powerDerivative(base, exp, name) {
      if (!dependsOn(exp, name)) {
        if (exp.t === "num" && isInteger(exp.v)) {
          return mkBin("*", mkBin("*", num(exp.v), mkBin("^", base, num(exp.v - 1))), derivative(base, name));
        }
        return mkBin("*", mkBin("*", exp, mkBin("^", base, mkBin("-", exp, num(1)))), derivative(base, name));
      }
      var power = mkBin("^", base, exp);
      var inner = mkBin("+",
        mkBin("*", derivative(exp, name), mkCall("ln", [base])),
        mkBin("*", exp, mkBin("/", derivative(base, name), base)));
      return mkBin("*", power, inner);
    }

    function callDerivative(n, name) {
      var u = n.args[0], du = derivative(u, name), sq = mkBin("^", u, num(2));
      switch (n.name) {
        case "sin": return mkBin("*", mkCall("cos", [u]), du);
        case "cos": return mkBin("*", mkNeg(mkCall("sin", [u])), du);
        case "tan": return mkBin("/", du, mkBin("^", mkCall("cos", [u]), num(2)));
        case "cot": return mkBin("/", mkNeg(du), mkBin("^", mkCall("sin", [u]), num(2)));
        case "sinh": return mkBin("*", mkCall("cosh", [u]), du);
        case "cosh": return mkBin("*", mkCall("sinh", [u]), du);
        case "tanh": return mkBin("/", du, mkBin("^", mkCall("cosh", [u]), num(2)));
        case "sqrt":
        case "root":
          if (n.args.length > 1) {
            var p = n.args[1];
            return mkBin("/", du, mkBin("*", p, mkBin("^", mkCall("root", [u, p]), mkBin("-", p, num(1)))));
          }
          return mkBin("/", du, mkBin("*", num(2), mkCall("sqrt", [u])));
        case "exp": return mkBin("*", mkCall("exp", [u]), du);
        case "ln": return mkBin("/", du, u);
        case "lg":
        case "log":
        case "log10": return mkBin("/", du, mkBin("*", u, num(Math.LN10)));
        case "log2": return mkBin("/", du, mkBin("*", u, num(Math.LN2)));
        case "abs": return mkBin("*", mkCall("sign", [u]), du);
        case "arcsin": case "asin":
          return mkBin("/", du, mkCall("sqrt", [mkBin("-", num(1), sq)]));
        case "arccos": case "acos":
          return mkBin("/", mkNeg(du), mkCall("sqrt", [mkBin("-", num(1), sq)]));
        case "arctan": case "atan":
          return mkBin("/", du, mkBin("+", num(1), sq));
        case "sign": return num(0);
      }
      return num(0);
    }

    function derivative(n, name) {
      name = name || "x";
      if (!n) return num(0);
      switch (n.t) {
        case "num": return num(0);
        case "var": return num(n.name === name ? 1 : 0);
        case "neg": return mkNeg(derivative(n.a, name));
        case "call": return callDerivative(n, name);
        case "bin":
          var l = n.l, r = n.r, dl = derivative(l, name), dr = derivative(r, name);
          if (n.op === "+") return mkBin("+", dl, dr);
          if (n.op === "-") return mkBin("-", dl, dr);
          if (n.op === "*") return mkBin("+", mkBin("*", dl, r), mkBin("*", l, dr));
          if (n.op === "/") return mkBin("/", mkBin("-", mkBin("*", dl, r), mkBin("*", l, dr)), mkBin("^", r, num(2)));
          if (n.op === "^") return powerDerivative(l, r, name);
      }
      return num(0);
    }

    var OP_SYMBOLS = { "+": "+", "-": "−", "*": "·", "/": "/", "^": "^" };
    var FUNC_NAMES = {
      sqrt: "√", lg: "lg", log10: "lg", log2: "log₂", ln: "ln",
      asin: "arcsin", acos: "arccos", atan: "arctan"
    };
    function funcName(name) { return FUNC_NAMES[name] || name; }

    function nodeToString(n, parentPrec) {
      if (!n) return "";
      parentPrec = parentPrec || 0;
      var s, prec;
      switch (n.t) {
        case "num": s = fmtNum(n.v, 4); prec = 5; break;
        case "var": s = n.name; prec = 5; break;
        case "neg": s = "−" + nodeToString(n.a, 3); prec = 3; break;
        case "call":
          s = funcName(n.name) + "(" + n.args.map(function (a) { return nodeToString(a, 0); }).join(", ") + ")";
          prec = 5; break;
        case "bin":
          var p = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 }[n.op];
          if (n.op === "^" && n.r.t === "num" && isInteger(n.r.v)) {
            s = nodeToString(n.l, 4) + sup(n.r.v);
            prec = 5;
          } else {
            var lp = n.op === "/" ? 3 : (n.op === "^" ? 4 : p);
            var rp = (n.op === "-" || n.op === "/") ? p + 1 : (n.op === "^" ? 4 : p);
            s = nodeToString(n.l, lp) + " " + OP_SYMBOLS[n.op] + " " + nodeToString(n.r, rp);
            prec = p;
          }
          break;
        default: s = ""; prec = 5;
      }
      return prec < parentPrec ? "(" + s + ")" : s;
    }

    /* ---------- Численный анализ и график функции одной переменной ---------- */

    function numericAnalysis(ast, dast, params, xMin, xMax, steps, varName) {
      var N = steps || 700, h = (xMax - xMin) / N;
      var xs = [], ds = [], valid = [], maxAbs = 0, i;
      for (i = 0; i <= N; i++) {
        var x = xMin + i * h, values = {};
        values[varName] = x;
        var f = evalNode(ast, values, params), d = evalNode(dast, values, params);
        var ok = isFinite(f) && isFinite(d);
        xs.push(x); ds.push(d); valid.push(ok);
        if (ok) maxAbs = Math.max(maxAbs, Math.abs(d));
      }
      var tol = maxAbs * 1e-4 + 1e-9, flat = maxAbs < 1e-12;
      var candidates = [];
      for (i = 1; i <= N; i++) {
        if (!valid[i] || !valid[i - 1]) continue;
        var a = ds[i - 1], b = ds[i];
        if (a * b < 0) {
          var lo = xs[i - 1], hi = xs[i], dlo = a;
          for (var j = 0; j < 40; j++) {
            var mid = (lo + hi) / 2, vm = {}, dm;
            vm[varName] = mid;
            dm = evalNode(dast, vm, params);
            if (!isFinite(dm)) break;
            if (dlo * dm <= 0) hi = mid; else { lo = mid; dlo = dm; }
          }
          candidates.push((lo + hi) / 2);
        } else if (!flat && i < N && Math.abs(b) <= tol) {
          var prevAbs = Math.abs(a), nextAbs = Math.abs(ds[i + 1]), curAbs = Math.abs(b);
          if (curAbs <= prevAbs && curAbs <= nextAbs && curAbs < Math.max(prevAbs, nextAbs) * 0.5) candidates.push(xs[i]);
        }
      }
      if (flat) candidates = [];
      candidates.sort(function (p, q) { return p - q; });
      var rawRoots = [];
      candidates.forEach(function (c) {
        if (!rawRoots.length || Math.abs(c - rawRoots[rawRoots.length - 1]) > Math.max(h * 2, 0.01)) rawRoots.push(c);
      });
      var roots = rawRoots.map(function (r) {
        var best = r, bestAbs, step = Math.max(h, 1e-4);
        var vm = {}; vm[varName] = r;
        bestAbs = Math.abs(evalNode(dast, vm, params));
        for (var k = -5; k <= 5; k++) {
          var q = r + k * step; vm[varName] = q;
          var v = evalNode(dast, vm, params);
          if (isFinite(v) && Math.abs(v) < bestAbs) { bestAbs = Math.abs(v); best = q; }
        }
        return roundTo(best, 4);
      });

      var runs = [], start = -1;
      for (i = 0; i <= N; i++) {
        if (valid[i] && start < 0) start = i;
        if (start >= 0 && (!valid[i] || i === N)) { runs.push([start, valid[i] ? i : i - 1]); start = -1; }
      }
      var intervals = [];
      runs.forEach(function (run) {
        var from = xs[Math.max(0, run[0] - 1)], to = xs[Math.min(N, run[1] + 1)];
        var inner = roots.filter(function (r) { return r > from + 1e-6 && r < to - 1e-6; });
        var bounds = [from].concat(inner).concat([to]);
        for (var k = 0; k < bounds.length - 1; k++) {
          var l = bounds[k], r = bounds[k + 1];
          if (r - l < 1e-6) continue;
          var plus = 0, minus = 0;
          for (var s = 1; s <= 5; s++) {
            var q = l + (r - l) * s / 6, vm = {}; vm[varName] = q;
            var d = evalNode(dast, vm, params);
            if (isFinite(d) && d !== 0) { if (d > 0) plus++; else minus++; }
          }
          var sign = plus > minus ? "+" : minus > plus ? "−" : (plus === 0 && minus === 0 ? "0" : "?");
          intervals.push({ from: l, to: r, sign: sign });
        }
      });
      var classified = roots.map(function (r) {
        var before = null, after = null;
        intervals.forEach(function (iv) {
          if (iv.to <= r + 1e-6) before = iv.sign;
          if (!after && iv.from >= r - 1e-6) after = iv.sign;
        });
        var kind = before === "+" && after === "−" ? "max" : (before === "−" && after === "+" ? "min" : "none");
        var vm = {}; vm[varName] = r;
        var y = evalNode(ast, vm, params);
        return { x: r, y: isFinite(y) ? y : null, before: before, after: after, kind: kind };
      });
      return { roots: classified, intervals: intervals };
    }

    function niceStep(raw) {
      if (!(raw > 0)) return 1;
      var e = Math.floor(Math.log(raw) / Math.LN10), base = Math.pow(10, e), f = raw / base;
      var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
      return nice * base;
    }

    function computePlotLayout(ast, dast, assignments, varName) {
      var all = [];
      assignments.forEach(function (a) {
        numericAnalysis(ast, dast, a.params, -6, 6, 300, varName).roots.forEach(function (r) { all.push(r.x); });
      });
      var lo = -2, hi = 2;
      all.forEach(function (x) { lo = Math.min(lo, x); hi = Math.max(hi, x); });
      var span = Math.max(hi - lo, 4);
      var stepX = niceStep((span * 1.3) / 8);
      var xMin = Math.max(-12, Math.floor((lo - span * 0.15) / stepX) * stepX);
      var xMax = Math.min(12, Math.ceil((hi + span * 0.15) / stepX) * stepX);
      if (xMax - xMin < stepX * 2) { xMin -= stepX; xMax += stepX; }
      var yLo = Infinity, yHi = -Infinity, i;
      assignments.forEach(function (a) {
        for (i = 0; i <= 240; i++) {
          var x = xMin + (xMax - xMin) * i / 240, vm = {}; vm[varName] = x;
          var y = evalNode(ast, vm, a.params);
          if (isFinite(y)) { yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); }
        }
      });
      if (!isFinite(yLo)) { yLo = -1; yHi = 1; }
      yLo = Math.min(yLo, 0); yHi = Math.max(yHi, 0);
      if (yHi - yLo < 1e-6) { yLo -= 1; yHi += 1; }
      var stepY = niceStep((yHi - yLo) / 6);
      return {
        xMin: xMin, xMax: xMax, stepX: stepX,
        yMin: Math.floor((yLo - stepY * 0.1) / stepY) * stepY,
        yMax: Math.ceil((yHi + stepY * 0.1) / stepY) * stepY,
        stepY: stepY
      };
    }

    var plotRegistry = {}, plotSeq = 0;
    var PLOT_COLORS = ["#2563eb", "#b45309", "#059669", "#7c3aed", "#0891b2", "#be185d"];

    function escXml(text) {
      return String(text).replace(/[&<>"']/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
      });
    }

    function axesMarkup(id, b, px, py, W, H, L, R, T, B, xName, yName) {
      var svg = '<defs><marker id="' + id + '-arrow" viewBox="0 0 10 10" refX="9" refY="5"'
        + ' markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker>'
        + '<clipPath id="' + id + '-clip"><rect x="' + L + '" y="' + T + '" width="' + (W - L - R)
        + '" height="' + (H - T - B) + '"/></clipPath></defs>';
      var g, X, Y;
      for (g = Math.ceil(b.xMin / b.stepX) * b.stepX; g <= b.xMax + 1e-9; g += b.stepX) {
        X = roundTo(px(g), 2);
        svg += '<line x1="' + X + '" y1="' + T + '" x2="' + X + '" y2="' + (H - B) + '" stroke="#e2e8f0"/>';
        if (Math.abs(g) > 1e-9) svg += '<text x="' + X + '" y="' + (H - B + 17)
          + '" text-anchor="middle" font-size="11" fill="#64748b">' + fmtNum(g, 2) + "</text>";
      }
      for (g = Math.ceil(b.yMin / b.stepY) * b.stepY; g <= b.yMax + 1e-9; g += b.stepY) {
        Y = roundTo(py(g), 2);
        svg += '<line x1="' + L + '" y1="' + Y + '" x2="' + (W - R) + '" y2="' + Y + '" stroke="#e2e8f0"/>';
        if (Math.abs(g) > 1e-9) svg += '<text x="' + (L - 8) + '" y="' + (Y + 4)
          + '" text-anchor="end" font-size="11" fill="#64748b">' + fmtNum(g, 2) + "</text>";
      }
      svg += '<line x1="' + L + '" y1="' + roundTo(py(0), 2) + '" x2="' + (W - R + 4) + '" y2="' + roundTo(py(0), 2)
        + '" stroke="#334155" stroke-width="1.6" marker-end="url(#' + id + '-arrow)"/>';
      svg += '<line x1="' + roundTo(px(0), 2) + '" y1="' + (H - B + 4) + '" x2="' + roundTo(px(0), 2) + '" y2="' + (T - 4)
        + '" stroke="#334155" stroke-width="1.6" marker-end="url(#' + id + '-arrow)"/>';
      svg += '<text x="' + (roundTo(px(0), 2) - 10) + '" y="' + (roundTo(py(0), 2) + 16) + '" font-size="12" fill="#0f172a">O</text>';
      svg += '<text x="' + (W - R + 10) + '" y="' + (roundTo(py(0), 2) - 8) + '" font-size="12" fill="#0f172a">' + escXml(xName) + "</text>";
      svg += '<text x="' + (roundTo(px(0), 2) + 8) + '" y="' + (T - 6) + '" font-size="12" fill="#0f172a">' + escXml(yName) + "</text>";
      return svg;
    }

    function scaleText(p, b) {
      return "Масштаб: по " + p.xName + " — 1 деление = " + fmtNum(b.stepX, 2)
        + "; по " + p.yName + " — 1 деление = " + fmtNum(b.stepY, 2)
        + (p.kind === "contour" ? "; цвет линии соответствует значению функции" : "")
        + ".";
    }

    function registerPlot(id, p, bounds) {
      p.id = id;
      p.bounds = bounds;
      plotRegistry[id] = p;
      return '<div class="method-plot-wrap" data-plot-id="' + id + '">'
        + '<div class="plot-svg-host">' + p.render(bounds) + "</div>"
        + '<p class="plot-scale">' + scaleText(p, bounds) + "</p>"
        + '<p class="plot-hint">Наведите курсор на линию графика — появятся координаты. Перетащите поле, чтобы сдвинуть окно; колесо мыши меняет масштаб.</p>'
        + "</div>";
    }

    function curvePlot(ast, dast, assignments, layout, varName, yName) {
      var id = "plot-" + (++plotSeq);
      var W = 640, H = 320, L = 56, R = 24, T = 20, B = 44;
      var p = {
        id: id, kind: "curve", xName: varName, yName: yName || "f(" + varName + ")",
        W: W, H: H, L: L, R: R, T: T, B: B
      };

      p.render = function (b) {
        var px = function (x) { return L + (x - b.xMin) / (b.xMax - b.xMin) * (W - L - R); };
        var py = function (y) { return H - B - (y - b.yMin) / (b.yMax - b.yMin) * (H - T - B); };
        var svg = '<svg class="method-plot" data-plot-id="' + id + '" viewBox="0 0 ' + W + " " + H
          + '" role="img" aria-label="График функции с осями, масштабом и экстремумами">';
        svg += axesMarkup(id, b, px, py, W, H, L, R, T, B, varName, p.yName);
        svg += '<g clip-path="url(#' + id + '-clip)">';
        assignments.forEach(function (a, idx) {
          var d = "", drawing = false, i;
          for (i = 0; i <= 360; i++) {
            var x = b.xMin + (b.xMax - b.xMin) * i / 360, vm = {}; vm[varName] = x;
            var y = evalNode(ast, vm, a.params);
            if (isFinite(y)) {
              d += (drawing ? " L " : " M ") + roundTo(px(x), 2) + " " + roundTo(py(y), 2);
              drawing = true;
            } else drawing = false;
          }
          svg += '<path class="curve-line" d="' + d + '" fill="none" stroke="' + PLOT_COLORS[idx % PLOT_COLORS.length]
            + '" stroke-width="2.4" stroke-linejoin="round"/>';
        });
        assignments.forEach(function (a, idx) {
          a.analysis.roots.forEach(function (r) {
            if (r.y !== null && r.kind !== "none" && r.x >= b.xMin && r.x <= b.xMax) {
              svg += '<circle cx="' + roundTo(px(r.x), 2) + '" cy="' + roundTo(py(r.y), 2) + '" r="4.5" fill="'
                + PLOT_COLORS[idx % PLOT_COLORS.length] + '" stroke="#fff" stroke-width="1.5"><title>x = '
                + fmtNum(r.x) + "; y = " + fmtNum(r.y) + "</title></circle>";
            }
          });
        });
        svg += "</g>";
        assignments.slice(0, 4).forEach(function (a, idx) {
          svg += '<g><line x1="' + (L + 8) + '" y1="' + (T + 12 + idx * 16) + '" x2="' + (L + 26) + '" y2="'
            + (T + 12 + idx * 16) + '" stroke="' + PLOT_COLORS[idx] + '" stroke-width="3"/>'
            + '<text x="' + (L + 32) + '" y="' + (T + 16 + idx * 16) + '" font-size="11" fill="#334155">'
            + escXml(a.label) + "</text></g>";
        });
        svg += '<g class="plot-hover" visibility="hidden" pointer-events="none">'
          + '<line class="hover-v" y1="' + T + '" y2="' + (H - B) + '" stroke="#64748b" stroke-dasharray="4 3"/>'
          + '<line class="hover-h" x1="' + L + '" x2="' + (W - R) + '" stroke="#64748b" stroke-dasharray="4 3"/>'
          + '<rect class="hover-bg" rx="6" fill="#ffffff" fill-opacity="0.96" stroke="#cbd5e1"/>'
          + '<text class="hover-text" font-size="12" fill="#0f172a"></text></g></svg>';
        return svg;
      };

      p.hitTest = function (vx, vy) {
        var b = p.bounds;
        var px = L + (0 - b.xMin) / (b.xMax - b.xMin) * (W - L - R);
        var scaleX = (W - L - R) / (b.xMax - b.xMin);
        var x = b.xMin + (vx - L) / scaleX;
        var bestDist = 14, bestY = null;
        assignments.forEach(function (a) {
          var vm = {}; vm[varName] = x;
          var y = evalNode(ast, vm, a.params);
          if (!isFinite(y)) return;
          var py = H - B - (y - b.yMin) / (b.yMax - b.yMin) * (H - T - B);
          var dist = Math.abs(vy - py);
          if (dist < bestDist) { bestDist = dist; bestY = py; }
        });
        if (bestY === null) return null;
        var lines = [varName + " = " + fmtNum(x, 3)];
        assignments.forEach(function (a) {
          var vm = {}; vm[varName] = x;
          var y = evalNode(ast, vm, a.params);
          var prefix = assignments.length > 1 ? a.label + ": " : "";
          lines.push(prefix + "y = " + (isFinite(y) ? fmtNum(y, 3) : "нет значения"));
        });
        return { lines: lines, markerX: vx, markerY: bestY };
      };

      return registerPlot(id, p, layout);
    }

    /* ---------- Функции нескольких переменных: частные производные и карта уровней ---------- */

    function defaultValues(variables, params) {
      var values = {};
      params.forEach(function (name) { values[name] = 1; });
      variables.forEach(function (name) { values[name] = 0; });
      return values;
    }

    function findCriticalPoints(ast, partials, variables, params) {
      var a = variables[0], b = variables[1];
      var base = defaultValues(variables, params);
      var candidates = [], maxGrad = 0, i, j;
      for (i = 0; i <= 80; i++) {
        for (j = 0; j <= 80; j++) {
          var x = -4 + i * 8 / 80, y = -4 + j * 8 / 80;
          var values = Object.assign({}, base); values[a] = x; values[b] = y;
          var g1 = evalNode(partials[0].ast, values, params);
          var g2 = evalNode(partials[1].ast, values, params);
          if (!isFinite(g1) || !isFinite(g2)) continue;
          var mag = Math.abs(g1) + Math.abs(g2);
          maxGrad = Math.max(maxGrad, mag);
        }
      }
      var tol = maxGrad * 0.02 + 1e-4;
      for (i = 0; i <= 80; i++) {
        for (j = 0; j <= 80; j++) {
          var xx = -4 + i * 8 / 80, yy = -4 + j * 8 / 80;
          var v2 = Object.assign({}, base); v2[a] = xx; v2[b] = yy;
          var p1 = evalNode(partials[0].ast, v2, params);
          var p2 = evalNode(partials[1].ast, v2, params);
          if (isFinite(p1) && isFinite(p2) && Math.abs(p1) + Math.abs(p2) <= tol) {
            candidates.push({ x: xx, y: yy });
          }
        }
      }
      var clusters = [];
      candidates.forEach(function (c) {
        var found = null;
        clusters.forEach(function (cl) {
          if (Math.abs(cl.x - c.x) < 0.3 && Math.abs(cl.y - c.y) < 0.3) found = cl;
        });
        if (!found) clusters.push({ x: c.x, y: c.y, n: 1 });
        else { found.x = (found.x * found.n + c.x) / (found.n + 1); found.y = (found.y * found.n + c.y) / (found.n + 1); found.n++; }
      });
      return clusters.map(function (c) {
        var bx = c.x, by = c.y, step = 0.1;
        for (var k = 0; k < 30; k++) {
          var best = null, bestMag = Infinity;
          [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(function (d) {
            var vv = Object.assign({}, base);
            vv[a] = bx + d[0] * step; vv[b] = by + d[1] * step;
            var g1 = evalNode(partials[0].ast, vv, params);
            var g2 = evalNode(partials[1].ast, vv, params);
            if (!isFinite(g1) || !isFinite(g2)) return;
            var mag = Math.abs(g1) + Math.abs(g2);
            if (mag < bestMag) { bestMag = mag; best = [vv[a], vv[b]]; }
          });
          if (!best) break;
          bx = best[0]; by = best[1];
          step *= 0.7;
        }
        var values = Object.assign({}, base); values[a] = bx; values[b] = by;
        var z = evalNode(ast, values, params);
        var around = [];
        [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15], [0.12, 0.12], [-0.12, -0.12]].forEach(function (d) {
          var vv = Object.assign({}, base); vv[a] = bx + d[0]; vv[b] = by + d[1];
          var fv = evalNode(ast, vv, params);
          if (isFinite(fv)) around.push(fv);
        });
        var kind = "перегиб/седло";
        if (around.length && around.every(function (v) { return v >= z - 1e-9; })) kind = "минимум";
        else if (around.length && around.every(function (v) { return v <= z + 1e-9; })) kind = "максимум";
        return { x: roundTo(bx, 3), y: roundTo(by, 3), z: z, kind: kind };
      });
    }

    function contourSegments(valuesGrid, bounds, nx, ny, levels, toPx, toPy) {
      var segments = [];
      var xs = [], ys = [], i, j;
      for (i = 0; i <= nx; i++) xs.push(bounds.xMin + (bounds.xMax - bounds.xMin) * i / nx);
      for (j = 0; j <= ny; j++) ys.push(bounds.yMin + (bounds.yMax - bounds.yMin) * j / ny);
      levels.forEach(function (level, li) {
        for (j = 0; j < ny; j++) {
          for (i = 0; i < nx; i++) {
            var v00 = valuesGrid[j][i], v10 = valuesGrid[j][i + 1];
            var v11 = valuesGrid[j + 1][i + 1], v01 = valuesGrid[j + 1][i];
            var pts = [];
            if ((v00 < level) !== (v10 < level)) {
              var t = (level - v00) / (v10 - v00);
              pts.push([xs[i] + t * (xs[i + 1] - xs[i]), ys[j]]);
            }
            if ((v10 < level) !== (v11 < level)) {
              var t2 = (level - v10) / (v11 - v10);
              pts.push([xs[i + 1], ys[j] + t2 * (ys[j + 1] - ys[j])]);
            }
            if ((v01 < level) !== (v11 < level)) {
              var t3 = (level - v01) / (v11 - v01);
              pts.push([xs[i] + t3 * (xs[i + 1] - xs[i]), ys[j + 1]]);
            }
            if ((v00 < level) !== (v01 < level)) {
              var t4 = (level - v00) / (v01 - v00);
              pts.push([xs[i], ys[j] + t4 * (ys[j + 1] - ys[j])]);
            }
            for (var k = 0; k + 1 < pts.length; k += 2) {
              segments.push({
                ax: toPx(pts[k][0]), ay: toPy(pts[k][1]),
                bx: toPx(pts[k + 1][0]), by: toPy(pts[k + 1][1]),
                z: level, color: PLOT_COLORS[li % PLOT_COLORS.length]
              });
            }
          }
        }
      });
      return segments;
    }

    function distToSegment(px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      var t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      var qx = ax + t * dx, qy = ay + t * dy;
      return { d: Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy)), x: qx, y: qy };
    }

    function contourPlot(ast, variables, params, critical) {
      var id = "plot-" + (++plotSeq);
      var W = 640, H = 360, L = 56, R = 24, T = 20, B = 44;
      var p = {
        id: id, kind: "contour", xName: variables[0], yName: variables[1],
        W: W, H: H, L: L, R: R, T: T, B: B
      };
      var base = defaultValues(variables, params);
      p.evalAt = function (x, y) {
        var values = Object.assign({}, base);
        values[variables[0]] = x; values[variables[1]] = y;
        return evalNode(ast, values, params);
      };
      var lo = -4, hi = 4;
      critical.forEach(function (c) { lo = Math.min(lo, c.x, c.y); hi = Math.max(hi, c.x, c.y); });
      var step = niceStep((hi - lo) / 4);
      var bounds = {
        xMin: Math.floor(lo / step) * step, xMax: Math.ceil(hi / step) * step,
        yMin: Math.floor(lo / step) * step, yMax: Math.ceil(hi / step) * step,
        stepX: step, stepY: step
      };

      p.render = function (b) {
        var px = function (x) { return L + (x - b.xMin) / (b.xMax - b.xMin) * (W - L - R); };
        var py = function (y) { return H - B - (y - b.yMin) / (b.yMax - b.yMin) * (H - T - B); };
        var nx = 64, ny = 44, valuesGrid = [], i, j, zMin = Infinity, zMax = -Infinity;
        for (j = 0; j <= ny; j++) {
          var row = [];
          for (i = 0; i <= nx; i++) {
            var x = b.xMin + (b.xMax - b.xMin) * i / nx;
            var y = b.yMin + (b.yMax - b.yMin) * j / ny;
            var z = p.evalAt(x, y);
            if (isFinite(z)) { zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
            row.push(z);
          }
          valuesGrid.push(row);
        }
        var levels = [];
        if (!isFinite(zMin)) { zMin = -1; zMax = 1; }
        if (zMax - zMin < 1e-9) { zMin -= 1; zMax += 1; }
        for (i = 1; i <= 7; i++) levels.push(zMin + (zMax - zMin) * i / 8);
        p.segments = contourSegments(valuesGrid, b, nx, ny, levels, px, py);

        var svg = '<svg class="method-plot" data-plot-id="' + id + '" viewBox="0 0 ' + W + " " + H
          + '" role="img" aria-label="Карта уровней функции нескольких переменных">';
        svg += axesMarkup(id, b, px, py, W, H, L, R, T, B, variables[0], variables[1]);
        svg += '<g clip-path="url(#' + id + '-clip)">';
        p.segments.forEach(function (s) {
          svg += '<line x1="' + roundTo(s.ax, 2) + '" y1="' + roundTo(s.ay, 2) + '" x2="' + roundTo(s.bx, 2)
            + '" y2="' + roundTo(s.by, 2) + '" stroke="' + s.color + '" stroke-width="2"><title>f = '
            + fmtNum(s.z, 2) + "</title></line>";
        });
        critical.forEach(function (c) {
          if (c.x >= b.xMin && c.x <= b.xMax && c.y >= b.yMin && c.y <= b.yMax) {
            svg += '<circle cx="' + roundTo(px(c.x), 2) + '" cy="' + roundTo(py(c.y), 2)
              + '" r="5" fill="#0f172a" stroke="#fff" stroke-width="1.5"><title>критическая точка ('
              + fmtNum(c.x) + "; " + fmtNum(c.y) + "), f = " + fmtNum(c.z) + "</title></circle>";
          }
        });
        svg += "</g>";
        levels.slice(0, 6).forEach(function (z, li) {
          svg += '<g><line x1="' + (L + 8) + '" y1="' + (T + 12 + li * 16) + '" x2="' + (L + 26) + '" y2="'
            + (T + 12 + li * 16) + '" stroke="' + PLOT_COLORS[li] + '" stroke-width="3"/>'
            + '<text x="' + (L + 32) + '" y="' + (T + 16 + li * 16) + '" font-size="11" fill="#334155">f = '
            + fmtNum(z, 2) + "</text></g>";
        });
        svg += '<g class="plot-hover" visibility="hidden" pointer-events="none">'
          + '<line class="hover-v" y1="' + T + '" y2="' + (H - B) + '" stroke="#64748b" stroke-dasharray="4 3"/>'
          + '<line class="hover-h" x1="' + L + '" x2="' + (W - R) + '" stroke="#64748b" stroke-dasharray="4 3"/>'
          + '<rect class="hover-bg" rx="6" fill="#ffffff" fill-opacity="0.96" stroke="#cbd5e1"/>'
          + '<text class="hover-text" font-size="12" fill="#0f172a"></text></g></svg>';
        return svg;
      };

      p.hitTest = function (vx, vy) {
        var b = p.bounds, best = null, bestDist = 14;
        (p.segments || []).forEach(function (s) {
          var hit = distToSegment(vx, vy, s.ax, s.ay, s.bx, s.by);
          if (hit.d < bestDist) { bestDist = hit.d; best = { hit: hit, z: s.z }; }
        });
        if (!best) return null;
        var scaleX = (W - L - R) / (b.xMax - b.xMin);
        var scaleY = (H - T - B) / (b.yMax - b.yMin);
        var x = b.xMin + (best.hit.x - L) / scaleX;
        var y = b.yMin + (H - B - best.hit.y) / scaleY;
        return {
          lines: [variables[0] + " = " + fmtNum(x, 2), variables[1] + " = " + fmtNum(y, 2),
            "f = " + fmtNum(p.evalAt(x, y), 3)],
          markerX: best.hit.x, markerY: best.hit.y
        };
      };
      return registerPlot(id, p, bounds);
    }

    /* ---------- Тексты анализа и генерация методики ---------- */

    function intervalText(iv) {
      return "(" + fmtNum(iv.from, 2) + "; " + fmtNum(iv.to, 2) + ")";
    }
    function signWord(sign) {
      return sign === "+" ? "f′ > 0, функция возрастает"
        : sign === "−" ? "f′ < 0, функция убывает"
          : sign === "0" ? "f′ = 0, функция постоянна" : "знак производной не определён";
    }
    function extremaText(analysis, varName, showY) {
      varName = varName || "x";
      showY = showY !== false;
      var items = analysis.roots.filter(function (r) { return r.kind !== "none"; }).map(function (r) {
        return (r.kind === "max" ? "максимум" : "минимум") + " при " + varName + " = " + fmtNum(r.x, 2)
          + (showY && r.y !== null ? ", f = " + fmtNum(r.y, 2) : "");
      });
      return items.length ? items.join("; ") : "экстремумов нет";
    }
    function describeAssignment(a, varName, showY) {
      var parts = a.analysis.intervals.map(function (iv) { return intervalText(iv) + " — " + signWord(iv.sign); });
      return a.label + ": " + (parts.length ? parts.join(", ") : "область определения не найдена")
        + "; " + extremaText(a.analysis, varName, showY);
    }
    function paramEffect(assignments, varName, showY) {
      if (assignments.length < 2) return describeAssignment(assignments[0], varName, showY);
      var counts = assignments.map(function (a) {
        return a.analysis.roots.filter(function (r) { return r.kind !== "none"; }).length;
      });
      var trend = counts[counts.length - 1] < counts[0] ? "увеличение параметра уменьшает число экстремумов"
        : counts[counts.length - 1] > counts[0] ? "увеличение параметра увеличивает число экстремумов"
          : "число экстремумов от параметра не зависит";
      return assignments.map(function (a) {
        return a.label + " — " + extremaText(a.analysis, varName, showY);
      }).join(". ") + ". " + trend;
    }
    function changeExplanation(assignments, varName, showY) {
      varName = varName || "x";
      showY = showY !== false;
      return assignments.map(function (a) {
        var changes = a.analysis.roots.filter(function (r) { return r.kind !== "none"; }).map(function (r) {
          return "при " + varName + " = " + fmtNum(r.x, 2) + " знак "
            + (r.kind === "max" ? "+ → − (максимум" : "− → + (минимум")
            + (showY && r.y !== null ? ", f = " + fmtNum(r.y, 2) : "") + ")";
        });
        return a.label + ": " + (changes.length ? changes.join("; ") : "знак производной не меняется, экстремумов нет");
      }).join("; ");
    }

    function buildMethodology(typeKey, input) {
      var parsed = parseExpression(input.formula);
      var ast = parsed ? parsed.ast : null;
      var variables = parsed ? parsed.variables : [];
      var params = ast ? paramsIn(ast, [], variables) : [];
      var keyParam = params[0] || null;
      var multi = variables.length > 1;
      var derivativeMode = !!(parsed && parsed.isDerivative);
      var varName = variables[0] || "x";
      var showY = !derivativeMode;
      var formulaText = ast
        ? (derivativeMode ? "f′(" : "f(") + variables.join(", ") + ") = " + nodeToString(ast)
        : String(input.formula || "не задана");
      var derivText = "", analysisText = "", plotHtml = "";
      var partials = [], critical = [], assignments = [], dast = null;

      if (ast && multi) {
        partials = variables.map(function (name) {
          return { name: name, ast: simplify(derivative(ast, name)) };
        });
        critical = findCriticalPoints(ast, partials, variables, params);
        derivText = partials.map(function (q) {
          return "∂f/∂" + q.name + " = " + nodeToString(q.ast);
        }).join("; ");
        analysisText = critical.length
          ? critical.map(function (c) {
            return "(" + fmtNum(c.x, 2) + "; " + fmtNum(c.y, 2) + "), f = " + fmtNum(c.z, 2) + " — " + c.kind;
          }).join("; ")
          : "в области построения критических точек не найдено";
        plotHtml = contourPlot(ast, variables, params, critical);
      } else if (ast) {
        var signAst = derivativeMode ? ast : simplify(derivative(ast, varName));
        dast = simplify(derivative(ast, varName));
        var demoValues = keyParam ? [-3, 0, 3] : [null];
        demoValues.forEach(function (v) {
          var p = {};
          params.forEach(function (name) { p[name] = v === null ? 1 : v; });
          assignments.push({ params: p, label: keyParam ? keyParam + " = " + fmtNum(v, 0) : "без параметра", analysis: null });
        });
        var layout = computePlotLayout(ast, signAst, assignments, varName);
        assignments.forEach(function (a) {
          a.analysis = numericAnalysis(ast, signAst, a.params, layout.xMin, layout.xMax, 700, varName);
        });
        derivText = derivativeMode
          ? formulaText + "; f″(" + varName + ") = " + nodeToString(dast)
          : "f′(" + varName + ") = " + nodeToString(dast);
        analysisText = assignments.map(function (a) { return describeAssignment(a, varName, showY); }).join("; ");
        plotHtml = curvePlot(ast, signAst, assignments, layout, varName,
          derivativeMode ? "f′(" + varName + ")" : "f(" + varName + ")");
      }

      var implementation = '<div class="method-implementation"><h5>Реализация конкретного примера</h5>';
      if (ast) {
        implementation += "<p><strong>Формула:</strong> " + escapeHtml(formulaText) + "</p>";
        implementation += "<p><strong>" + (multi ? "Частные производные" : "Производная") + ":</strong> "
          + escapeHtml(derivText) + "</p>";
        implementation += "<p><strong>Анализ:</strong> " + escapeHtml(analysisText) + "</p>";
        implementation += plotHtml;
        implementation += '<p class="small">' + (multi
          ? "Карта уровней построена для первых двух переменных; остальные переменные зафиксированы нулями. Точки отмечены в критических точках."
          : "Отмечены экстремумы. График можно перемещать и масштабировать.")
          + "</p>";
      } else {
        implementation += "<p>Формула не распознана. Укажите переменные буквами в скобках, например "
          + "<code>f(t) = sin(t)</code> или <code>f(x,y) = x^2 + y^2</code>. Доступны + − * / ^, скобки, "
          + "sin, cos, tan, cot, sqrt, exp, ln, lg, abs, arcsin, arccos, arctan и параметры.</p>";
      }
      implementation += "</div>";

      var step3 = ast
        ? "<p><strong>Численный анализ:</strong> " + escapeHtml(analysisText) + ". " + escapeHtml(derivText) + ".</p>"
        : "<p>Численный анализ невозможен, пока формула не распознана.</p>";
      var step4;
      if (!ast) {
        step4 = "<p>Уточните запись формулы, чтобы получить конкретные выводы по вашему примеру.</p>";
      } else if (multi) {
        step4 = "<p><strong>Вывод по вашему примеру:</strong> " + escapeHtml(analysisText)
          + ". Знаки частных производных показывают, как функция меняется вдоль каждой оси; "
          + "карта уровней позволяет проверить это наблюдение за пределами видимого окна.</p>";
      } else if (typeKey === "model") {
        step4 = "<p><strong>Влияние параметра:</strong> " + escapeHtml(paramEffect(assignments, varName, showY))
          + ". Сравните смену числа экстремумов при разных значениях " + escapeHtml(keyParam || "параметра") + ".</p>";
      } else if (typeKey === "explanation") {
        step4 = "<p><strong>Обоснование:</strong> " + escapeHtml(changeExplanation(assignments, varName, showY))
          + ". Интервалы монотонности: " + escapeHtml(analysisText) + ".</p>";
      } else if (typeKey === "research") {
        step4 = "<p><strong>Результат исследования:</strong> " + escapeHtml(paramEffect(assignments, varName, showY))
          + ". Смена знака: " + escapeHtml(changeExplanation(assignments, varName, showY)) + ".</p>";
      } else {
        step4 = "<p><strong>Структура формулы:</strong> " + escapeHtml(formulaText) + "; "
          + escapeHtml(analysisText) + ". Сопоставьте найденные интервалы и экстремумы с видом графика.</p>";
      }

      var steps = [
        ["1. Зафиксируйте формулу", "<p>Введено: <strong>" + escapeHtml(formulaText) + "</strong>. "
          + (params.length ? "Параметры: " + escapeHtml(params.join(", ")) + "." : "Параметров нет.") + "</p>"],
        ["2. Найдите производную", "<p>" + escapeHtml(derivText) + "</p>"],
        ["3. Проанализируйте знак и точки", step3],
        ["4. Сформулируйте вывод", step4]
      ];
      return '<div class="generated-method"><h4>Методика для вашего задания</h4><ol class="method-steps">'
        + steps.map(function (s) { return "<li><strong>" + s[0] + "</strong>" + s[1] + "</li>"; }).join("")
        + "</ol>" + implementation + "</div>";
    }

    /* ---------- Наведение на линию, перемещение и масштабирование графика ---------- */

    function redrawPlot(p, wrap, bounds) {
      p.bounds = bounds;
      wrap.querySelector(".plot-svg-host").innerHTML = p.render(bounds);
      wrap.querySelector(".plot-scale").textContent = scaleText(p, bounds);
      var svg = wrap.querySelector("svg.method-plot");
      if (svg) bindPlotSvg(svg, p, wrap);
    }

    function bindPlotSvg(svg, p, wrap) {
      var hover = svg.querySelector(".plot-hover");
      var vline = svg.querySelector(".hover-v");
      var hline = svg.querySelector(".hover-h");
      var bg = svg.querySelector(".hover-bg");
      var text = svg.querySelector(".hover-text");
      if (!hover || !vline || !hline || !bg || !text) return;
      function hide() { hover.setAttribute("visibility", "hidden"); }
      function show(hit) {
        vline.setAttribute("x1", hit.markerX); vline.setAttribute("x2", hit.markerX);
        hline.setAttribute("y1", hit.markerY); hline.setAttribute("y2", hit.markerY);
        var boxW = 230, boxH = hit.lines.length * 17 + 10;
        var bx = Math.min(Math.max(hit.markerX + 12, p.L + 4), p.W - p.R - boxW - 4);
        var by = Math.min(Math.max(hit.markerY - boxH - 10, p.T + 4), p.H - p.B - boxH - 4);
        bg.setAttribute("x", bx); bg.setAttribute("y", by);
        bg.setAttribute("width", boxW); bg.setAttribute("height", boxH);
        while (text.firstChild) text.removeChild(text.firstChild);
        text.setAttribute("y", by + 14);
        hit.lines.forEach(function (line, i) {
          var ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
          ts.setAttribute("x", bx + 8);
          ts.setAttribute("dy", i === 0 ? 0 : 16);
          ts.textContent = line;
          text.appendChild(ts);
        });
        hover.setAttribute("visibility", "visible");
      }
      svg.addEventListener("mousemove", function (ev) {
        if (p.dragging) { hide(); return; }
        var rect = svg.getBoundingClientRect();
        var vx = (ev.clientX - rect.left) / rect.width * p.W;
        var vy = (ev.clientY - rect.top) / rect.height * p.H;
        if (vx < p.L || vx > p.W - p.R || vy < p.T || vy > p.H - p.B) { hide(); return; }
        var hit = p.hitTest(vx, vy);
        if (hit) show(hit); else hide();
      });
      svg.addEventListener("mouseleave", hide);

      function dragEnd() {
        p.dragging = null;
        svg.classList.remove("is-dragging");
        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);
      }
      function dragMove(ev) {
        var d = p.dragging;
        if (!d) return;
        var b = Object.assign({}, d.bounds);
        var dxPx = (ev.clientX - d.x) / d.rect.width * p.W;
        var dyPx = (ev.clientY - d.y) / d.rect.height * p.H;
        var spanX = d.bounds.xMax - d.bounds.xMin;
        var spanY = d.bounds.yMax - d.bounds.yMin;
        var dx = -dxPx / (p.W - p.L - p.R) * spanX;
        var dy = dyPx / (p.H - p.T - p.B) * spanY;
        b.xMin += dx; b.xMax += dx; b.yMin += dy; b.yMax += dy;
        redrawPlot(p, wrap, b);
        d.x = ev.clientX; d.y = ev.clientY;
        d.bounds = Object.assign({}, b);
      }
      svg.addEventListener("mousedown", function (ev) {
        if (ev.button !== 0) return;
        ev.preventDefault();
        hide();
        p.dragging = { x: ev.clientX, y: ev.clientY, bounds: Object.assign({}, p.bounds), rect: svg.getBoundingClientRect() };
        svg.classList.add("is-dragging");
        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
      });
      svg.addEventListener("wheel", function (ev) {
        ev.preventDefault();
        hide();
        var rect = svg.getBoundingClientRect();
        var vx = (ev.clientX - rect.left) / rect.width * p.W;
        var vy = (ev.clientY - rect.top) / rect.height * p.H;
        var b = p.bounds;
        var spanX = b.xMax - b.xMin, spanY = b.yMax - b.yMin;
        var factor = ev.deltaY > 0 ? 1.2 : 1 / 1.2;
        var nSpanX = Math.max(0.02, Math.min(1000, spanX * factor));
        var nSpanY = Math.max(0.02, Math.min(1000, spanY * factor));
        var rx = (vx - p.L) / (p.W - p.L - p.R);
        var ry = (p.H - p.B - vy) / (p.H - p.T - p.B);
        var dataX = b.xMin + rx * spanX;
        var dataY = b.yMin + ry * spanY;
        var nb = Object.assign({}, b);
        nb.xMin = dataX - rx * nSpanX; nb.xMax = nb.xMin + nSpanX;
        nb.yMin = dataY - ry * nSpanY; nb.yMax = nb.yMin + nSpanY;
        nb.stepX = b.stepX * nSpanX / spanX;
        nb.stepY = b.stepY * nSpanY / spanY;
        redrawPlot(p, wrap, nb);
      }, { passive: false });
    }

    function attachPlotInteractions() {
      Array.prototype.forEach.call(result.querySelectorAll(".method-plot-wrap[data-plot-id]"), function (wrap) {
        var p = plotRegistry[wrap.getAttribute("data-plot-id")];
        var svg = wrap.querySelector("svg.method-plot");
        if (p && svg) bindPlotSvg(svg, p, wrap);
      });
    }
  }
}());
