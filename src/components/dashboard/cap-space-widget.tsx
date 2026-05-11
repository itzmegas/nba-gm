"use client";

import { AlertTriangle, DollarSign } from "lucide-react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SalaryCapCalculator } from "@/domain/services/SalaryCapCalculator";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

interface CapSpaceWidgetProps {
  gameId: string;
  teamId: string;
}

export function CapSpaceWidget({ gameId, teamId }: CapSpaceWidgetProps) {
  const { data: contracts, isLoading } = useTeamContracts(gameId, teamId);

  const calculator = new SalaryCapCalculator();

  const status = contracts ? calculator.getFinancialStatus(contracts) : null;

  if (isLoading || !status) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Situación Salarial</CardTitle>
          <CardDescription>Calculando finanzas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const SALARY_CAP = 140_000_000;
  const LUXURY_TAX = 170_000_000;
  const FIRST_APRON = 178_000_000;

  const capPercentage = Math.min((status.totalSalary / SALARY_CAP) * 100, 100);

  let progressColor = "bg-primary";
  if (status.isOverLuxuryTax) progressColor = "bg-destructive";
  else if (status.isOverCap) progressColor = "bg-orange-500";

  return (
    <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Salary Cap
          </CardTitle>
          {status.isOverLuxuryTax && (
            <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-md font-medium">
              <AlertTriangle className="h-3 w-3" />
              LUXURY TAX
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-baseline">
              <span className="text-3xl font-black tracking-tighter">
                {formatCurrency(status.totalSalary)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Gasto Total
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span
                className={
                  status.isOverCap
                    ? "text-destructive font-medium"
                    : "text-green-500 font-medium"
                }
              >
                {status.isOverCap
                  ? `${formatCurrency(status.totalSalary - SALARY_CAP)} OVER CAP`
                  : `${formatCurrency(status.capSpace)} ESPACIO`}
              </span>
              <span className="text-muted-foreground text-xs">
                Cap: {formatCurrency(SALARY_CAP)}
              </span>
            </div>
          </div>

          <div className="relative h-4 w-full bg-muted rounded-full overflow-hidden mt-4">
            <div
              className={`absolute top-0 left-0 h-full ${progressColor} transition-all duration-1000 ease-out`}
              style={{ width: `${capPercentage}%` }}
            />
            {status.totalSalary > SALARY_CAP && (
              <div
                className="absolute top-0 h-full bg-orange-500 opacity-80"
                style={{
                  left: "100%",
                  width: `${Math.min(((status.totalSalary - SALARY_CAP) / SALARY_CAP) * 100, 100)}%`,
                  marginLeft: "-100%",
                }}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4 border-t text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                Luxury Tax Limit
              </span>
              <span className="font-medium">{formatCurrency(LUXURY_TAX)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs">First Apron</span>
              <span className="font-medium">{formatCurrency(FIRST_APRON)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
