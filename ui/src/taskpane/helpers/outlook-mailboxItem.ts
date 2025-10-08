/* global Office */

import { getSubjectLine } from "./emailMetadata";
import { sanitizeString } from "./sanitization";

type StorageKeyResolution = {
  key: string | null;
  identifiers: {
    itemId: string | null;
    internetMessageId: string | null;
    conversationId: string | null;
    subject: string | null;
  };
};

const getItemId = async (item: any): Promise<string | null> => {
  const directId = sanitizeString(item?.itemId);
  if (directId) {
    return directId;
  }

  const getItemIdAsync =
    typeof item?.getItemIdAsync === "function" ? item.getItemIdAsync.bind(item) : null;
  if (!getItemIdAsync) {
    return null;
  }

  return new Promise((resolve) => {
    getItemIdAsync((asyncResult: Office.AsyncResult<string>) => {
      if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
        resolve(sanitizeString(asyncResult.value));
      } else {
        resolve(null);
      }
    });
  });
};

export const resolveStorageKeyForCurrentItem = async (): Promise<StorageKeyResolution> => {
  const mailbox = Office.context.mailbox;
  const currentItem = mailbox?.item as any;

  if (!currentItem) {
    return {
      key: null,
      identifiers: {
        itemId: null,
        internetMessageId: null,
        conversationId: null,
        subject: null,
      },
    };
  }

  const itemId = await getItemId(currentItem);
  const internetMessageId = sanitizeString(currentItem.internetMessageId);
  const conversationId = sanitizeString(currentItem.conversationId);
  const normalizedSubject = sanitizeString(currentItem.normalizedSubject);
  const subject = normalizedSubject ?? (await getSubjectLine(currentItem));

  const candidates = [
    itemId,
    internetMessageId,
    conversationId,
    subject ? `subject:${subject}` : null,
  ];
  const key = candidates.find((candidate) => !!candidate) ?? null;

  return {
    key,
    identifiers: {
      itemId,
      internetMessageId,
      conversationId,
      subject: subject ?? null,
    },
  };
};
