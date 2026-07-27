import PlaceholderPage from "../../components/PlaceholderPage";

export default function Billing() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PlaceholderPage title="Billing" note="Billing report will be built out in a later iteration." />
      <PlaceholderPage
        title="Revenue Projection"
        note="Revenue projection (within Billing) will be built out in a later iteration."
      />
    </div>
  );
}
