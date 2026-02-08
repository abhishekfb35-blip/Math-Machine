import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCreateHistory } from "@/hooks/use-history";
import * as math from "mathjs";
import { Delete, Eraser, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorProps {
  initialExpression?: string;
  onExpressionChange: (expr: string) => void;
}

export function Calculator({ initialExpression = "", onExpressionChange }: CalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  
  const createHistory = useCreateHistory();

  useEffect(() => {
    if (initialExpression) {
      setExpression(initialExpression);
      setDisplay(initialExpression);
      setWaitingForOperand(false);
    }
  }, [initialExpression]);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setExpression(expression + digit);
      setWaitingForOperand(false);
    } else {
      const newDisplay = display === "0" ? digit : display + digit;
      setDisplay(newDisplay);
      setExpression(expression === "0" ? digit : expression + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setExpression(expression + ".");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
      setExpression(expression + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setExpression("");
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
      setExpression(expression.slice(0, -1));
    } else {
      setDisplay("0");
      setExpression("");
    }
  };

  const inputOperator = (op: string) => {
    // Only allow operator if expression is not empty or ends with a number
    if (expression && !/[+\-*/]$/.test(expression)) {
      setExpression(expression + op);
      setWaitingForOperand(true);
    } else if (/[+\-*/]$/.test(expression)) {
      // Replace last operator
      setExpression(expression.slice(0, -1) + op);
    }
  };

  const calculate = async () => {
    try {
      // Evaluate expression safely
      const result = math.evaluate(expression);
      
      // Format result nicely
      const formattedResult = math.format(result, { precision: 14 });
      
      setDisplay(String(formattedResult));
      
      // Save to history
      createHistory.mutate({
        expression: expression,
        result: String(formattedResult)
      });
      
      // Prepare for next calculation
      setExpression(String(formattedResult));
      setWaitingForOperand(true);
    } catch (error) {
      setDisplay("Error");
      setWaitingForOperand(true);
      setExpression("");
    }
  };

  const handleKeyClick = (key: string) => {
    if (/\d/.test(key)) {
      inputDigit(key);
    } else if (key === ".") {
      inputDot();
    } else if (["+", "-", "*", "/"].includes(key)) {
      inputOperator(key);
    } else if (key === "=" || key === "Enter") {
      calculate();
    } else if (key === "Backspace") {
      backspace();
    } else if (key === "Escape" || key === "C") {
      clear();
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (/\d/.test(key)) {
        inputDigit(key);
      } else if (key === ".") {
        inputDot();
      } else if (["+", "-", "*", "/"].includes(key)) {
        inputOperator(key);
      } else if (key === "=" || key === "Enter") {
        event.preventDefault();
        calculate();
      } else if (key === "Backspace") {
        backspace();
      } else if (key === "Escape") {
        clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [display, expression, waitingForOperand]);

  const CalcButton = ({ 
    label, 
    onClick, 
    className, 
    variant = "default" 
  }: { 
    label: React.ReactNode; 
    onClick: () => void; 
    className?: string;
    variant?: "default" | "primary" | "secondary" | "accent";
  }) => {
    const variants = {
      default: "bg-secondary text-foreground hover:bg-secondary/80",
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25",
      secondary: "bg-muted text-foreground hover:bg-muted/80",
      accent: "bg-accent/20 text-accent hover:bg-accent/30 border border-accent/20",
    };

    return (
      <button
        onClick={onClick}
        className={cn(
          "calc-btn h-16 md:h-20 w-full rounded-2xl text-xl md:text-2xl font-medium transition-all duration-200",
          variants[variant],
          className
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="w-full max-w-sm glass rounded-3xl p-6 border border-white/10 flex flex-col gap-6 shadow-2xl">
      {/* Display Screen */}
      <div className="relative bg-black/40 rounded-2xl p-6 h-32 flex flex-col items-end justify-end overflow-hidden border border-white/5 shadow-inner">
        <div className="text-muted-foreground text-sm font-mono mb-2 h-6 flex items-center">
          {expression || "0"}
        </div>
        <div className="text-4xl md:text-5xl font-mono font-medium tracking-tight text-foreground truncate w-full text-right">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-3 md:gap-4">
        <CalcButton label="C" onClick={clear} variant="accent" />
        <CalcButton label={<Eraser className="w-6 h-6" />} onClick={clear} variant="accent" className="text-sm" />
        <CalcButton label={<Delete className="w-6 h-6" />} onClick={backspace} variant="accent" />
        <CalcButton label="÷" onClick={() => inputOperator("/")} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" />

        <CalcButton label="7" onClick={() => inputDigit("7")} />
        <CalcButton label="8" onClick={() => inputDigit("8")} />
        <CalcButton label="9" onClick={() => inputDigit("9")} />
        <CalcButton label="×" onClick={() => inputOperator("*")} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" />

        <CalcButton label="4" onClick={() => inputDigit("4")} />
        <CalcButton label="5" onClick={() => inputDigit("5")} />
        <CalcButton label="6" onClick={() => inputDigit("6")} />
        <CalcButton label="-" onClick={() => inputOperator("-")} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" />

        <CalcButton label="1" onClick={() => inputDigit("1")} />
        <CalcButton label="2" onClick={() => inputDigit("2")} />
        <CalcButton label="3" onClick={() => inputDigit("3")} />
        <CalcButton label="+" onClick={() => inputOperator("+")} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" />

        <CalcButton label="0" onClick={() => inputDigit("0")} className="col-span-2" />
        <CalcButton label="." onClick={inputDot} />
        <CalcButton 
          label={<Equal className="w-8 h-8" />} 
          onClick={calculate} 
          variant="primary"
          className="bg-gradient-to-br from-primary to-purple-600 border border-white/10"
        />
      </div>
    </div>
  );
}
