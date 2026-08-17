import { Router, type IRouter } from "express";
import {
  ListConversationsResponse,
  OpenConversationBody,
  OpenConversationResponse,
  ListDmMessagesParams,
  ListDmMessagesResponse,
  MarkConversationReadParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/authz";
import {
  getConversation,
  getOrCreateConversation,
  isParticipant,
  listConversationsFor,
  listMessages,
  markRead,
  shapeForUser,
} from "../lib/dm";

const router: IRouter = Router();

// Every DM route is scoped to the authenticated user's own conversations.
router.use("/dm", requireAuth);

router.get("/dm/conversations", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const rows = await listConversationsFor(userId);
  res.json(ListConversationsResponse.parse(rows.map((r) => shapeForUser(r, userId))));
});

router.post("/dm/open", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = OpenConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { otherUserId, otherName, otherAvatar } = parsed.data;
  if (otherUserId === userId) {
    res.status(400).json({ error: "لا يمكنك مراسلة نفسك" });
    return;
  }
  const conversation = await getOrCreateConversation(
    { userId },
    { userId: otherUserId, name: otherName, avatar: otherAvatar },
  );
  res.json(OpenConversationResponse.parse(shapeForUser(conversation, userId)));
});

router.get("/dm/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = ListDmMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conversation = await getConversation(params.data.id);
  if (!conversation) {
    res.status(404).json({ error: "المحادثة غير موجودة" });
    return;
  }
  if (!isParticipant(conversation, userId)) {
    res.status(403).json({ error: "لست طرفاً في هذه المحادثة" });
    return;
  }
  const messages = await listMessages(conversation.id);
  res.json(
    ListDmMessagesResponse.parse(
      messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    ),
  );
});

router.post("/dm/conversations/:id/read", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const params = MarkConversationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conversation = await getConversation(params.data.id);
  if (!conversation) {
    res.status(404).json({ error: "المحادثة غير موجودة" });
    return;
  }
  if (!isParticipant(conversation, userId)) {
    res.status(403).json({ error: "لست طرفاً في هذه المحادثة" });
    return;
  }
  await markRead(conversation, userId);
  res.sendStatus(204);
});

export default router;
