import { LoginForm } from "@/components/login-form";
import { PageShell } from "@/components/ui";

export default function LoginPage() {
  return (
    <PageShell className="justify-center">
      <LoginForm />
    </PageShell>
  );
}
