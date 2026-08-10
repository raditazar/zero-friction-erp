import * as React from "react";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
  AppDialogTrigger,
  AppDialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function LicenseDialog({ children }: { children: React.ReactNode }) {
  return (
    <AppDialog>
      <AppDialogTrigger asChild>
        {children}
      </AppDialogTrigger>
      <AppDialogContent size="md">
        <AppDialogHeader>
          <AppDialogTitle>Attributions</AppDialogTitle>
          <AppDialogDescription>
            Licenses and attributions for third-party assets used in Zero Friction ERP.
          </AppDialogDescription>
        </AppDialogHeader>
        <AppDialogBody>
          <div className="space-y-4 text-sm text-[#25221F]">
            <div>
              <h3 className="font-semibold text-base mb-1">idn-finlogos</h3>
              <p className="mb-2">
                The bank and e-wallet logos used in this application are provided by the <strong>idn-finlogos</strong> project.
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-2">
                <li>
                  Logo assets are licensed under the <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)</a>.
                </li>
                <li>
                  The original source code of the project is licensed under the MIT License by Hafidz Noor Fauzi.
                </li>
              </ul>
              <p>
                Project Repository: <a href="https://github.com/hafidznoorfauzi/idn-finlogos" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">github.com/hafidznoorfauzi/idn-finlogos</a>
              </p>
            </div>
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <AppDialogClose asChild>
            <Button variant="outline">Close</Button>
          </AppDialogClose>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
