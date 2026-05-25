import { createFileRoute } from "@tanstack/react-router";
import { VentasCommon } from "./ventas-common";

export const Route = createFileRoute("/_authenticated/ventas-cantarito")({
  component: () => <VentasCommon branchTitle="Cantarito Taque-ria & Karaoke" branchKey="cantarito" />,
});
