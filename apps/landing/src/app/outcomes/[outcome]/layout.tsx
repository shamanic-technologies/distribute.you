import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function OutcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      {children}
      <Footer
        disclaimer={
          <>
            Prices are the live average across every brand we run, updated
            continuously. Individual results vary by industry and offer.
          </>
        }
      />
    </>
  );
}
