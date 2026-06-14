import {
  listPointRules,
  listGameTypesForEdit,
} from "@/lib/admin/config-repository";
import ConfigEditor from "./config-editor";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const [rules, gameTypes] = await Promise.all([
    listPointRules(),
    listGameTypesForEdit(),
  ]);
  return <ConfigEditor rules={rules} gameTypes={gameTypes} />;
}
