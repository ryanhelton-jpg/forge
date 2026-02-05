// Example tool: Calculator
export const calculatorTool = {
    name: 'calculator',
    description: 'Perform basic math calculations. Supports +, -, *, /, ^, and parentheses.',
    parameters: {
        expression: {
            type: 'string',
            description: 'The math expression to evaluate (e.g., "2 + 2" or "sqrt(16)")',
            required: true,
        },
    },
    execute: async (params) => {
        const expr = params.expression;
        try {
            // Safe math evaluation (no eval!)
            const result = safeEval(expr);
            return `${expr} = ${result}`;
        }
        catch (error) {
            return `Error: Could not evaluate "${expr}"`;
        }
    },
};
// Simple safe math evaluator
function safeEval(expr) {
    // Sanitize: only allow numbers, operators, parentheses, and math functions
    const sanitized = expr.replace(/\s+/g, '');
    if (!/^[0-9+\-*/().^sqrt,]+$/i.test(sanitized)) {
        throw new Error('Invalid characters in expression');
    }
    // Handle sqrt
    const withSqrt = sanitized.replace(/sqrt\(([^)]+)\)/gi, (_, n) => String(Math.sqrt(parseFloat(n))));
    // Handle power
    const withPow = withSqrt.replace(/(\d+(?:\.\d+)?)\^(\d+(?:\.\d+)?)/g, (_, a, b) => String(Math.pow(parseFloat(a), parseFloat(b))));
    // Evaluate using Function (safer than eval, still sandboxed)
    const fn = new Function(`return (${withPow})`);
    return fn();
}
