import { createFileRoute } from "@tanstack/react-router";
import { VentasCommon } from "./ventas-common";

export const Route = createFileRoute("/_authenticated/ventas")({
  component: () => <VentasCommon branchTitle="Borrego" branchKey="borrego" loadAll />,
});
