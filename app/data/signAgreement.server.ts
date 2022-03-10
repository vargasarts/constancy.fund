import sendEmail from "aws-sdk-plus/dist/sendEmail";
import createAPIGatewayProxyHandler from "aws-sdk-plus/dist/createAPIGatewayProxyHandler";
import { execute } from "../../app/data/mysql.server";
import { users } from "@clerk/clerk-sdk-node";
import { render as renderInvestorSigned } from "../../app/emails/InvestorSigned";
import { render as renderCreatorSigned } from "../../app/emails/CreatorSigned";
import FUNDRAISE_TYPES from "../../app/enums/fundraiseTypes";
import eversign from "../../app/data/eversign.server";
import { MethodNotAllowedError, NotFoundError } from "aws-sdk-plus/dist/errors";
import getPaymentPreferences from "../../app/data/getPaymentPreferences.server";

const logic = ({ agreementUuid }: { agreementUuid: string }) => {
  return execute(
    `SELECT e.id, i.uuid, i.name, i.email, c.userId, c.type
     FROM agreement a
     INNER JOIN investor i ON i.uuid = a.investorUuid
     INNER JOIN eversigndocument e ON a.uuid = e.agreementUuid
     INNER JOIN contract c ON c.uuid = a.contractUuid
     WHERE a.uuid = ?`,
    [agreementUuid]
  )
    .then((results) => {
      const [doc] = results as {
        id: string;
        uuid: string;
        name: string;
        email: string;
        userId: string;
        type: number;
      }[];
      if (!doc)
        throw new NotFoundError(
          `Could not find eversign document associated with agreement ${agreementUuid}`
        );
      return Promise.all([
        eversign
          .getDocumentByHash(doc.id)
          .then((r) =>
            r.getSigners().reduce((p, c) => (c.getSigned() ? p + 1 : p), 0)
          ),
        users.getUser(doc.userId).then((u) => ({
          investorEmail: doc.email,
          investorName: doc.name,
          investorUuid: doc.uuid,
          userEmail:
            u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
              ?.emailAddress || "",
          userName: `${u.firstName} ${u.lastName}`,
          documentId: doc.id,
          contractType: FUNDRAISE_TYPES[doc.type || 0].name,
          id: u.id,
        })),
      ]);
    })
    .then(([numSigners, r]) => {
      if (numSigners === 1) {
        return getPaymentPreferences(r.investorUuid).then(
          (investorPaymentPreferences) =>
            sendEmail({
              to: r.userEmail,
              replyTo: r.investorEmail,
              subject: `${r.investorName} has signed the agreement!`,
              body: renderInvestorSigned({
                investorName: r.investorName,
                investorPaymentPreferences,
                creatorName: r.userName,
                contractType: r.contractType,
                agreementUuid,
              }),
            })
        );
      } else if (numSigners === 2) {
        return getPaymentPreferences(r.id).then((creatorPaymentPreferences) =>
          sendEmail({
            to: r.investorEmail,
            replyTo: r.userEmail,
            subject: `${r.userName} has signed the agreement!`,
            body: renderCreatorSigned({
              investorName: r.investorName,
              creatorName: r.userName,
              contractType: r.contractType,
              creatorPaymentPreferences,
            }),
          })
        );
      } else {
        throw new MethodNotAllowedError(`No one has actually signed`);
      }
    })
    .then(() => ({ success: true }));
};

export const handler = createAPIGatewayProxyHandler(logic);
export type Handler = typeof logic;