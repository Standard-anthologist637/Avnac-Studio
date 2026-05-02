import { Outlet, createRootRoute } from "@tanstack/react-router";

import NativeTitleTooltip from "../components/native-title-tooltip";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <NativeTitleTooltip />
      <Outlet />
    </>
  );
}
