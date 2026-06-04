import { makeCatchAllHandler } from "../../_lib/catchAll";

const handler = makeCatchAllHandler("/v1/email-templates");
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
