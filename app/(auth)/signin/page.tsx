import type { Metadata } from "next";
import { SigninForm } from "@/components/signin-form";

export const metadata: Metadata = {
  title: "Sign in · ScoreMate",
};

export default function SigninPage() {
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Sign in
        </h1>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Save the teams, leagues, sports, and tournaments you follow.
        </p>
      </header>
      <SigninForm />
    </section>
  );
}
