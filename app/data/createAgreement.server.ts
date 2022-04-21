import getMysql, { Execute } from "./mysql.server";
import {
  MethodNotAllowedError,
  InternalServorError,
  BadRequestError,
} from "aws-sdk-plus/dist/errors";
import FUNDRAISE_TYPES from "../enums/fundraiseTypes";
import { FE_PUBLIC_DIR } from "fuegojs/dist/common";
import path from "path";
import type { Handler as ContractHandler } from "../../functions/create-contract-pdf";
import { v4 } from "uuid";
import { Id, dbTypeById } from "~/enums/paymentPreferences";

const createPaymentPreferences = ({
  userId,
  paymentPreferences,
  execute,
}: {
  userId: string;
  paymentPreferences: (readonly [Id, (readonly [string, string])[]])[];
  execute: Execute;
}) => {
  const paymentPreferenceRecords = paymentPreferences.map(([type, fields]) => ({
    uuid: v4(),
    type: dbTypeById[type],
    fields: fields.map(([label, value]) => ({
      label,
      value,
      uuid: v4(),
    })),
  }));
  return execute(
    `INSERT INTO paymentpreference (uuid, type, userId) VALUES ${paymentPreferenceRecords
      .map(() => "(?,?,?)")
      .join(",")}`,
    paymentPreferenceRecords.map((r) => [r.uuid, r.type, userId]).flat()
  ).then(() =>
    execute(
      `INSERT INTO paymentpreferencedetail (uuid, label, value, paymentPreferenceUuid) VALUES ${paymentPreferenceRecords
        .flatMap((p) => p.fields.map(() => "(?,?,?,?)"))
        .join(",")}`,
      paymentPreferenceRecords
        .flatMap((r) => r.fields.map((f) => [f.uuid, f.label, f.value, r.uuid]))
        .flat()
    )
  );
};

const createAgreement = ({
  uuid,
  name,
  email,
  amount,
  contractUuid,
  userId,
  investorAddressStreet,
  investorAddressNumber,
  investorAddressCity,
  investorAddressZip,
  investorAddressCountry,
  paymentPreferences,
}: {
  name: string;
  amount: number;
  email: string;
  uuid?: string;
  contractUuid?: string;
  userId: string;
  investorAddressNumber: string;
  investorAddressStreet: string;
  investorAddressCity: string;
  investorAddressZip: string;
  investorAddressCountry: string;
  paymentPreferences: (readonly [Id, (readonly [string, string])[]])[];
}) =>
  getMysql().then(({ execute, destroy }) => {
    return (
      uuid
        ? execute(
            `UPDATE investor i
           INNER JOIN agreement a ON a.investorUuid = i.uuid 
           SET i.name=?, i.email=?, a.amount=?
           WHERE a.uuid=?`,
            [name, email, amount, uuid]
          ).then(() => uuid)
        : Promise.resolve(v4()).then((agreementUuid) =>
            (contractUuid
              ? Promise.resolve(contractUuid)
              : execute(
                  `SELECT c.uuid
                FROM contract c
                WHERE c.userId = ?`,
                  [userId]
                ).then((res) => (res as { uuid: string }[])[0]?.uuid)
            ).then((contractUuid) => {
              const investorUuid = v4();
              return execute(
                `INSERT INTO investor (uuid, name, email) VALUES (?, ?, ?)`,
                [investorUuid, name, email]
              )
                .then(() =>
                  Promise.all([
                    execute(
                      `INSERT INTO agreement (uuid, amount, contractUuid, investorUuid)
           VALUES (?, ?, ?, ?)`,
                      [agreementUuid, amount, contractUuid, investorUuid]
                    ),
                    createPaymentPreferences({
                      paymentPreferences,
                      userId: investorUuid,
                      execute,
                    }),
                  ])
                )
                .then(() => agreementUuid);
            })
          )
    )
      .then((agreementUuid) => {
        return execute(
          `SELECT c.userId, c.type, c.uuid, d.label, d.value
          FROM contract c
          INNER JOIN agreement a ON a.contractUuid = c.uuid
          INNER JOIN contractdetail d ON d.contractUuid = c.uuid
          WHERE a.uuid = ?`,
          [agreementUuid]
        ).then(async (results) => {
          const details = results as {
            uuid: string;
            type: number;
            userId: string;
            label: string;
            value: string;
          }[];
          const [c] = details;
          if (!c)
            throw new MethodNotAllowedError(
              `Cannot find fundraise tied to agreement ${agreementUuid}`
            );
          const detailData = Object.fromEntries(
            details.map(({ label, value }) => [label, value])
          );
          const capSpace =
            Number(detailData.amount) * Number(detailData.frequency);
          const investorShare = amount / capSpace;
          if (investorShare > 1) {
            throw new BadRequestError(
              `Cannot request to invest more than the available cap space ${capSpace}`
            );
          }
          return Promise.all([
            import("@clerk/clerk-sdk-node").then((clerk) =>
              clerk.users.getUser(c.userId)
            ),
            import("@dvargas92495/api/invokeDirect.js").then((invokeDirect) => {
              return invokeDirect.default<Parameters<ContractHandler>[0]>({
                path: "create-contract-pdf",
                data: {
                  uuid: c.uuid,
                  outfile: agreementUuid,
                  inputData: {
                    investor: name,
                    investor_location: `${investorAddressNumber} ${investorAddressStreet} ${investorAddressCity}, ${investorAddressCountry}, ${investorAddressZip}`,
                    amount: (
                      Number(detailData.amount) * investorShare
                    ).toString(),
                    share: (
                      Number(detailData.share) * investorShare
                    ).toString(),
                    return: (
                      Number(detailData.return) * investorShare
                    ).toString(),
                  },
                },
              })
            }),
          ]).then(([user]) => ({
            user,
            type: FUNDRAISE_TYPES[c.type].name,
            uuid: c.uuid,
            agreementUuid,
          }));
        });
      })
      .then(async (contract) => {
        const eversign = await import("@dvargas92495/eversign").then(e => e.default);
        const filePath = `_contracts/${contract.uuid}/${contract.agreementUuid}.pdf`;
        const creatorName = `${contract.user.firstName} ${contract.user.lastName}`;
        const creatorEmail =
          contract.user.emailAddresses.find(
            (e) => e.id === contract.user.primaryEmailAddressId
          )?.emailAddress || "";

        const file = new eversign.File(
          process.env.NODE_ENV === "development"
            ? {
                name: "contract",
                filePath: path.join(FE_PUBLIC_DIR, filePath),
              }
            : {
                name: "contract",
                fileUrl: `${process.env.ORIGIN}/${filePath}`,
              }
        );

        const investorSigner = new eversign.Signer({
          id: 1,
          name,
          email,
          deliverEmail: false,
        });
        const creatorSigner = new eversign.Signer({
          id: 2,
          name: creatorName,
          email: creatorEmail,
          deliverEmail: false,
        });

        const document = new eversign.Document({
          reminders: true,
          requireAllSigners: true,
          custom_requester_email: creatorEmail,
          custom_requester_name: creatorName,
          embeddedSigningEnabled: true,
          ...(process.env.IS_PRODUCTION && !process.env.EVERSIGN_SANDBOX
            ? {}
            : { sandbox: true }),
        });

        document.appendFile(file);
        document.appendSigner(investorSigner);
        document.appendSigner(creatorSigner);

        const client = new eversign.Client(
          process.env.EVERSIGN_API_KEY || "",
          398320
        );
        return client.createDocument(document).then((r) => {
          return { ...contract, id: r.getDocumentHash() };
        });
      })
      .then((r) =>
        execute(
          `INSERT INTO eversigndocument (id, agreementUuid)
        VALUES (?,?)`,
          [r.id, r.agreementUuid]
        ).then(() => {
          destroy();
          return r.agreementUuid;
        })
      )
      .then((uuid) => ({ uuid }))
      .catch((e) => {
        console.error(e);
        throw new InternalServorError(e.type || e.message);
      });
  });

export default createAgreement;
