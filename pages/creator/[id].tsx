import React, { useCallback, useEffect, useState } from "react";
import Layout, { LayoutHead } from "../_common/Layout";
import type { Props } from "./[id].data";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import H1 from "@dvargas92495/ui/dist/components/H1";
import H4 from "@dvargas92495/ui/dist/components/H4";
import Avatar from "@mui/material/Avatar";
import Subtitle from "@dvargas92495/ui/dist/components/Subtitle";
import Body from "@dvargas92495/ui/dist/components/Body";
import ExternalLink from "@dvargas92495/ui/dist/components/ExternalLink";
import TwitterIcon from "@mui/icons-material/Twitter";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import InstagramIcon from "@mui/icons-material/Instagram";
import FacebookIcon from "@mui/icons-material/Facebook";
import RedditIcon from "@mui/icons-material/Reddit";
import YouTubeIcon from "@mui/icons-material/YouTube";
import EmailIcon from "@mui/icons-material/Email";
import WebIcon from "@mui/icons-material/Public";
import QUESTIONAIRES from "../_common/questionaires";
import FUNDRAISE_TYPES from "../../db/fundraise_types";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import useHandler from "@dvargas92495/ui/dist/useHandler";
import type { Handler as GetHandler } from "../../functions/agreement/get";

const icons = [
  { test: /twitter\.com/, component: TwitterIcon },
  { test: /github\.com/, component: GitHubIcon },
  { test: /linkedin\.com/, component: LinkedInIcon },
  { test: /instagram\.com/, component: InstagramIcon },
  { test: /facebook\.com/, component: FacebookIcon },
  { test: /reddit\.com/, component: RedditIcon },
  { test: /youtube\.com/, component: YouTubeIcon },
  { test: /^mailto:/, component: EmailIcon },
  { test: /.*/, component: WebIcon },
];

type Agreement = Awaited<ReturnType<GetHandler>>;

const CreatorProfile = ({
  fullName,
  profileImageUrl,
  email,
  socialProfiles,
  questionaires,
  fundraises,
  setMode,
}: Props & {
  setMode: (m: { path: string; state?: Agreement }) => void;
}): React.ReactElement => {
  const [agreement, setAgreement] = useState<Agreement>();
  const getAgreement = useHandler<GetHandler>({
    path: "agreement",
    method: "GET",
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agreementUuid = params.get("agreement");
    if (agreementUuid) {
      getAgreement({ uuid: agreementUuid }).then((r) => {
        setAgreement(r);
      });
    }
  }, [setAgreement, getAgreement]);
  return (
    <>
      <H1 sx={{ fontSize: 24 }}>You've been invited to invest in {fullName}</H1>
      <Box display={"flex"} sx={{ marginBottom: "24px" }}>
        <Avatar src={profileImageUrl} sx={{ width: 76, height: 76 }} />
        <Box sx={{ paddingLeft: "16px", paddingTop: "4px" }}>
          <H4 sx={{ fontSize: 14, lineHeight: "20px", my: 0 }}>{fullName}</H4>
          <Subtitle sx={{ fontSize: 12, lineHeight: "20px", my: 0 }}>
            {email}
          </Subtitle>
          <Box>
            {socialProfiles.map((s, i) => {
              const SocialIcon =
                icons.find(({ test }) => test.test(s))?.component || WebIcon;
              return (
                <ExternalLink href={s} key={i}>
                  <SocialIcon
                    sx={{ opacity: 0.5, marginRight: "16px" }}
                    fontSize={"small"}
                  />
                </ExternalLink>
              );
            })}
          </Box>
        </Box>
      </Box>
      {QUESTIONAIRES.map(({ q }, i) => (
        <Box key={i} sx={{ mb: "48px" }}>
          <Subtitle
            sx={{ fontSize: 12, lineHeight: "20px", my: 0, color: "#888888" }}
          >
            {q}
          </Subtitle>
          <Body sx={{ my: "4px" }}>{questionaires[i]}</Body>
        </Box>
      ))}
      <Subtitle
        sx={{
          fontSize: 12,
          lineHeight: "20px",
          my: 0,
          color: "#888888",
          marginBottom: "8px",
        }}
      >
        Fundraises
      </Subtitle>
      {fundraises
        .filter((f) => !agreement || agreement.contractUuid === f.uuid)
        .map((f) => (
          <Card key={f.uuid} sx={{ padding: "32px" }}>
            <Box
              display={"flex"}
              justifyContent={"space-between"}
              alignItems={"center"}
            >
              <Box>
                <H1 sx={{ fontSize: 24, my: 0 }}>
                  {FUNDRAISE_TYPES[f.type].name}
                </H1>
                <Subtitle
                  sx={{
                    fontSize: 12,
                    lineHeight: "20px",
                    my: 0,
                    color: "#888888",
                  }}
                >
                  {FUNDRAISE_TYPES[f.type].description}
                </Subtitle>
              </Box>
              <Box>
                <Button
                  variant={"contained"}
                  color={"primary"}
                  onClick={() => setMode({ path: "details", state: agreement })}
                  sx={{ marginLeft: "16px" }}
                >
                  Invest
                </Button>
              </Box>
            </Box>
          </Card>
        ))}
    </>
  );
};

const EnterDetails = ({
  setMode,
  ...state
}: {
  setMode: (m: { path: string; state?: Agreement }) => void;
} & Partial<Agreement>) => {
  const [name, setName] = useState(state?.name || "");
  const [email, setEmail] = useState(state?.email || "");
  const [amount, setAmount] = useState(state?.amount || 0);
  const onSign = useCallback(() => {
    setMode({ path: "pending" });
  }, [setMode]);
  return (
    <>
      <Button
        sx={{ color: "#888888", marginBottom: "32px" }}
        onClick={() => setMode({ path: "profile" })}
      >
        Go Back
      </Button>
      <H1 sx={{ fontSize: 24 }}>Add your details</H1>
      <TextField
        sx={{ mb: 2 }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        label={"Name"}
        required
        fullWidth
      />
      <TextField
        sx={{ mb: 2 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        label={"Email"}
        required
        fullWidth
      />
      <TextField
        sx={{ mb: 2 }}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        label={"Investment Amount"}
        type={"number"}
        required
        fullWidth
        disabled={!!state?.amount}
      />
      <Button variant={"contained"} color={"primary"} onClick={onSign}>
        Continue to Signing Term Sheets
      </Button>
    </>
  );
};

const Pending = () => {
  return (
    <Box textAlign={"center"}>
      <H1 sx={{ fontSize: 24 }}>Hey check your email</H1>
      <Body>
        You will be sent a secure link to sign the generated contract.
      </Body>
    </Box>
  );
};

const CreatorLayout = (props: Props): React.ReactElement => {
  const [mode, setMode] = useState<{ path: string; state?: Agreement }>({
    path: "profile",
    state: undefined,
  });
  return (
    <Box
      sx={{
        maxWidth: "800px",
        width: "100%",
      }}
    >
      {mode.path === "profile" && (
        <CreatorProfile {...props} setMode={setMode} />
      )}
      {mode.path === "details" && (
        <EnterDetails {...mode.state} setMode={setMode} />
      )}
      {mode.path === "pending" && <Pending />}
    </Box>
  );
};

const CreatorPage = (props: Props): React.ReactElement => (
  <Layout>
    <CreatorLayout {...props} />
  </Layout>
);

export const Head = ({ fullName }: { fullName: string }) => (
  <LayoutHead title={fullName} />
);

export default CreatorPage;