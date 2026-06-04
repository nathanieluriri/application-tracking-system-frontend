import { LoginForm } from "./LoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-center">Sign in to ATS</CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
