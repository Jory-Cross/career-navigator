import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

const STATUS_ENDPOINT =
  "/api/functions/getCERegistrationCheckoutStatus";

function formatMoney(amountCents, currency) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount)) {
    return "";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${String(currency || "USD").toUpperCase()} ${(amount / 100).toFixed(2)}`;
  }
}

function getPresentation(paymentState) {
  switch (paymentState) {
    case "registration_payment_settled":
      return {
        eyebrow: "Payment confirmed",
        title: "Your CE Training registration payment was received.",
        description:
          "Create your account or sign in using the exact email address shown below. Your CE Training access will activate once Career Navigator recognizes that account.",
        badgeClass:
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        panelClass:
          "border-emerald-200 bg-emerald-50",
        iconClass:
          "bg-emerald-600",
        icon: "✓",
      };

    case "payment_confirmed_processing":
      return {
        eyebrow: "Payment received",
        title: "Stripe received your payment.",
        description:
          "Career Navigator is confirming your registration. This page checks again automatically in a few seconds.",
        badgeClass:
          "border-blue-200 bg-blue-50 text-blue-800",
        panelClass:
          "border-blue-200 bg-blue-50",
        iconClass:
          "bg-blue-600",
        icon: "…",
      };

    case "payment_not_completed":
      return {
        eyebrow: "Payment not completed",
        title: "Your CE Training registration payment is still open.",
        description:
          "Return to the secure payment link in your invitation email to complete checkout.",
        badgeClass:
          "border-amber-200 bg-amber-50 text-amber-800",
        panelClass:
          "border-amber-200 bg-amber-50",
        iconClass:
          "bg-amber-500",
        icon: "!",
      };

    case "payment_failed":
      return {
        eyebrow: "Payment needs attention",
        title: "Your CE Training registration payment was not completed.",
        description:
          "Use the secure payment link in your invitation email again, or contact your instructor for help.",
        badgeClass:
          "border-rose-200 bg-rose-50 text-rose-800",
          panelClass:
          "border-rose-200 bg-rose-50",
        iconClass:
          "bg-rose-600",
        icon: "!",
      };

    default:
      return {
        eyebrow: "Confirming registration",
        title: "Your CE Training registration is being confirmed.",
        description:
          "This can take a moment after payment. Refresh this page shortly if the status does not update.",
        badgeClass:
          "border-slate-200 bg-slate-50 text-slate-700",
        panelClass:
          "border-slate-200 bg-slate-50",
        iconClass:
          "bg-slate-600",
        icon: "…",
      };
  }
}

export default function CERegistrationPaymentStatus() {
  const [searchParams] = useSearchParams();
  const sessionId = String(
    searchParams.get("session_id") || ""
  ).trim();

  const [statusData, setStatusData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!sessionId) {
        setIsLoading(false);
        setError(
          "This CE Training payment-status link is missing its registration session."
        );
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError("");

      try {
        const response = await fetch(STATUS_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
        });

        const payload = await response
          .json()
          .catch(() => ({}));

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error ||
              "Unable to confirm this CE Training registration payment."
          );
        }

        setStatusData(payload);
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Unable to confirm this CE Training registration payment."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (
      statusData?.payment_state !==
      "payment_confirmed_processing"
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void loadStatus({ silent: true });
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadStatus, statusData?.payment_state]);

  const presentation = useMemo(
    () => getPresentation(statusData?.payment_state),
    [statusData?.payment_state]
  );

   const paymentSettled =
    statusData?.payment_state ===
    "registration_payment_settled";

  const instructorPaidReceipt =
    paymentSettled &&
    statusData?.is_instructor_paid_receipt === true;

  const canShowPaymentDetails =
    Number.isFinite(Number(statusData?.amount_cents)) &&
    statusData?.currency;

  const goToRegistration = () => {
    window.location.assign("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-base">
              🎓
            </span>
            CE Training
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Registration Payment Status
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Your CE Training Portal access is protected and activates only
            after payment is confirmed and your account uses the invited email.
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
              <h2 className="mt-5 text-lg font-semibold text-slate-900">
                Confirming your registration payment
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Please wait while Career Navigator checks the secure Stripe
                Checkout session.
              </p>
            </div>
          ) : error ? (
            <div className="px-6 py-10 sm:px-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-700">
                !
              </div>

              <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-rose-700">
                Payment status unavailable
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                We could not confirm this registration.
              </h2>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {error}
              </p>

                           <div className="mt-7">
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-6 py-6 sm:px-10">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ${presentation.iconClass}`}
                  >
                    {presentation.icon}
                  </div>

                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${presentation.badgeClass}`}
                    >
                      {presentation.eyebrow}
                    </span>

                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                      {presentation.title}
                    </h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                      {presentation.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6 sm:px-10">
                <div
                  className={`rounded-xl border p-5 ${presentation.panelClass}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Invited email
                  </p>

                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {statusData?.invited_email_hint ||
                      "Your invited email address"}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use this exact email address when you register or sign in.
                    A different email cannot be matched to this CE Training
                    invitation.
                  </p>
                </div>

                {canShowPaymentDetails ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Registration fee
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {formatMoney(
                        statusData.amount_cents,
                        statusData.currency
                      )}
                    </p>
                  </div>
                ) : null}

                               {paymentSettled ? (
                  instructorPaidReceipt ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
                      <p className="text-sm font-semibold text-violet-950">
                        Payment receipt
                      </p>

                      <p className="mt-2 text-sm leading-6 text-violet-900">
                        {statusData?.student_registration_email_state ===
                        "sent"
                          ? "Payment is confirmed. The student has been emailed instructions to register using their invited email address."
                          : statusData?.student_registration_email_state ===
                              "pending"
                            ? "Payment is confirmed. The student registration email is still being processed."
                            : "Payment is confirmed, but the student registration email needs attention. Please contact your CE administrator before asking the student to register."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
                      <p className="text-sm font-semibold text-violet-950">
                        Next step: create your account or sign in.
                      </p>

                      <p className="mt-2 text-sm leading-6 text-violet-900">
                        Your CE Training enrollment is already linked to its
                        Training cohort. Register or sign in using the invited
                        email address above so Career Navigator can safely
                        activate your CE Training access.
                      </p>

                      <button
                        type="button"
                        onClick={goToRegistration}
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700"
                      >
                        Register or Sign In
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void loadStatus()}
                      disabled={isRefreshing}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRefreshing
                        ? "Checking…"
                        : "Refresh Payment Status"}
                    </button>

                    <button
                      type="button"
                      onClick={goToRegistration}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Go to Career Navigator
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Need help? Contact your CE instructor. Do not share your payment
          link with anyone else.
        </p>
      </div>
    </main>
  );
}
