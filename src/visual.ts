/*
 *  Color Blindness by OKViz - Sample Visual
 *  v1.0.0
 *
 *  Copyright (c) SQLBI. OKViz is a trademark of SQLBI Corp.
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {

   interface VisualViewModel {
        dataPoints: VisualDataPoint[];
        domain: VisualDomain;
        settings: VisualSettings;
    }

    interface VisualDataPoint {
        displayName: string;
        value: number;
        color: string;
        selectionId: any;
    }

    interface VisualDomain {
        start?: number;
        end?: number;
    }

    interface VisualSettings {

        colorBlind: {
            vision?: string;
        }
    }

    function defaultSettings(): VisualSettings {
        return {

            colorBlind: {
                vision: "Normal"
            }
        };
    }

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): VisualViewModel {

        //Get DataViews
        let dataViews = options.dataViews;
        let hasDataViews = (dataViews && dataViews[0]);
        let hasCategoricalData = (hasDataViews && dataViews[0].categorical && dataViews[0].categorical.values);
        let hasSettings = (hasDataViews && dataViews[0].metadata && dataViews[0].metadata.objects);

        //Get Settings
        let settings: VisualSettings = defaultSettings();
        if (hasSettings) {
            let objects = dataViews[0].metadata.objects;
            settings = {
                colorBlind: {
                     vision: getValue<string>(objects, "colorBlind", "vision", settings.colorBlind.vision),
                }
            }
        } 

        //Get DataPoints
        let dataPoints: VisualDataPoint[] = [];
        let domain: VisualDomain = { };
        if (hasCategoricalData) {
            let dataCategorical = dataViews[0].categorical;
            for (let i = 0; i < dataCategorical.values.length; i++) {
                let dataValue = dataCategorical.values[i];
                if (dataValue.values[0]) {

                    let value = <number>dataValue.values[0];
                    domain.start = (domain.start !== undefined ? Math.min(domain.start, value) : value);
                    domain.end = (domain.end !== undefined ? Math.max(domain.end, value) : value);

                    let displayName = dataValue.source.displayName;
                    let identity = host.createSelectionIdBuilder().withMeasure(dataValue.source.queryName).createSelectionId();
                    let defaultColor: Fill = { solid: { color: host.colorPalette.getColor(displayName).value } };
                    let color = getValue<Fill>(dataValue.source.objects, "dataPoint", "fill", defaultColor).solid.color;

                    dataPoints.push(<VisualDataPoint>{
                        displayName: displayName,
                        value: value,
                        color: color,
                        selectionId: identity
                    });
                }
            }
        }

        return {
            dataPoints: dataPoints,
            domain: domain,
            settings: settings,
        };
    }

    export class Visual implements IVisual {
        private host: IVisualHost;
        private model: VisualViewModel;

        private element: d3.Selection<HTMLElement>;
        private svg: d3.Selection<SVGElement>;

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.model = { dataPoints: [], domain: {}, settings: <VisualSettings>{} };

            this.element = d3.select(options.element);
            this.svg = <any>this.element.append("svg");
        }
        
        public update(options: VisualUpdateOptions) {

            this.model = visualTransform(options, this.host);

            //Render visual
            let width = options.viewport.width;
            let height = options.viewport.height;
            this.svg.attr({ width: width, height: height });

            let yScale = d3.scale.linear()
                .domain([this.model.domain.start, this.model.domain.end])
                .range([height, 0]).nice();

            let dots = this.svg.selectAll(".dot").data(this.model.dataPoints);
            dots.enter()
                .append("circle")
                .classed("dot", true);
                
            dots.attr({
                "r": d => (yScale(d.value) / 2),
                "cy": d => (yScale(d.value) / 2),
                "cx": d => (yScale(d.value) / 2),
                "fill": d => d.color,
                "fill-opacity": 0.85
            });
            
            dots.exit().remove();


            //Apply color vision
            OKVizUtility.applyColorBlindVision(this.model.settings.colorBlind.vision, this.element);
        }

        public destroy(): void {
       
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch(objectName) {

                case 'dataPoint':
                    for(let i = 0; i < this.model.dataPoints.length; i++) {
                        let dataPoint = this.model.dataPoints[i];

                            objectEnumeration.push({
                                objectName: objectName,
                                displayName: dataPoint.displayName,
                                properties: {
                                    "fill": {
                                        solid: {
                                            color: dataPoint.color
                                        }
                                    }
                                },
                                selector: dataPoint.selectionId.getSelector()
                            });

                        }
                    break;
                
                
                case 'colorBlind':
                    
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            "vision": this.model.settings.colorBlind.vision
                        },
                        selector: null
                    });

                    break;
            };

            return objectEnumeration;
        }
    }
}