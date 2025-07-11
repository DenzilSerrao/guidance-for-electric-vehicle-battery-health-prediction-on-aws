/**
Copyright 2022 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

  http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
*/

import { fromEnv } from "@aws-sdk/credential-providers";
import { AppSyncClient } from "./appsync";
import {
  ForecastClient,
  GetAccuracyMetricsCommand,
  CreateForecastCommand,
} from "@aws-sdk/client-forecast";

const fcast = new ForecastClient({ region: process.env.AWS_REGION });
const appSync = new AppSyncClient({
  graphQlUrl: process.env.APPSYNC_GRAPHQL_URL!,
  credentials: fromEnv(),
});

/**
 * Builds response before sending back to UI
 * @param http_code
 * @param body
 */
function build_response(http_code: number, body: any) {
  return {
    headers: {
      "Cache-Control": "no-cache, no-store", // tell cloudfront and api gateway not to cache the response
      "Content-Type": "application/json",
    },
    statusCode: http_code,
    body: JSON.stringify(body),
  };
}

/**
 * Import training dataset into Forecast
 * @param event
 * @param context
 */
export async function handler(event?: any, context?: any) {
  let data: String[] = [];

  try {
    //arn:aws:forecast:us-east-1:157670018337:predictor/adi_uuid_1677311084939_01GT3RG306SGWBGQB65MNVDGY1
    const predArn = event["resources"][0];
    const fcastId = predArn.split("/")[1].split("_").slice(0, 2).join("_");
    const pipeId = fcastId.split("_")[1];

    // const fcastId = idParts.slice(0, 2).join("_");
    // const userId = idParts[0];
    // const pipeId = idParts[1];
    // const fcastId = `${userId}_${pipeId}`;

    const metrics = await fcast.send(
      new GetAccuracyMetricsCommand({ PredictorArn: predArn })
    );

    // Error in %age
    const wape =
      metrics.PredictorEvaluationResults![0].TestWindows![0].Metrics!
        .ErrorMetrics![0].WAPE!;
    data.push(`Predictor WAPE determined: ${wape}`);

    // TODO: this can just be reconstructed from userId and pipeId
    // Get S3 URI for pipe data from stored ddb entry
    const pipeData = await appSync.post({
      query: `query ($Id: String!) {
        getPipelineById(Id: $Id) {
          RawDataUri
        }
      }`,
      variables: { Id: pipeId },
    });

    const rawDataUri = pipeData.data.getPipelineById.RawDataUri;
    const pipeDataUri = rawDataUri.substring(0, rawDataUri.lastIndexOf("/"));
    const testIdsUri = `${pipeDataUri}/${process.env.TEST_IDS_KEY}`;

    const testSubset = {
      TimeSeriesSelector: {
        TimeSeriesIdentifiers: {
          DataSource: {
            S3Config: {
              Path: "s3://your-bucket/path/to/data.csv",
              RoleArn: process.env.YOUR_ROLE_ARN,
            },
          },
          Format: "CSV",
          Schema: {
            // Cast the AttributeType value as a literal
            Attributes: [{ AttributeName: "item_id", AttributeType: "string" as const }],
          },
        },
      },
    };

    const forecast = await fcast.send(
      new CreateForecastCommand({
        ForecastName: `${fcastId}_${Date.now()}`,
        PredictorArn: predArn,
        ForecastTypes: ["0.5"],
        ...testSubset,
      })
    );
    data.push(`Initiated forecast generation: ${forecast.ForecastArn}`);

    // Update pipeline info in ddb table
    await appSync.post({
      query: `mutation MyMutation($input: PipelineRequestInput!) {
        pipeline(input: $input) { Id PipelineStatus StatusUpdatedAt }
      }`,
      variables: {
        input: {
          Id: pipeId,
          TrainingFinishedAt: event["time"],
          ModelDrift: wape,
          ForecastArn: forecast.ForecastArn,
          PipelineStatus: process.env.PIPELINE_STATUS,
          StatusUpdatedAt: new Date().toISOString(),
        },
      },
    });
    data.push(`Pipeline status updated to ${process.env.PIPELINE_STATUS}`);

    return build_response(200, data);
  } catch (err) {
    console.error(err);
    data.push("Server Error");

    return build_response(500, data);
  }
}
