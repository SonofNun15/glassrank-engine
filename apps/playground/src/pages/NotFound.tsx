import { Button } from "@glassrank/design";
import type { MouseEvent } from "react";
import { href, navigate } from "../router";

export function NotFound() {
  return (
    <div className="page page-body stack">
      <h1 className="t-display-lg">Page not found</h1>
      <p className="t-body-lg lede">That page doesn't exist. Head back to the start to find your way.</p>
      <div className="actions">
        <Button
          href={href("/")}
          onClick={(e: MouseEvent) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          Go to the home page
        </Button>
      </div>
    </div>
  );
}
