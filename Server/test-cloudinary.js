"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import FeaturedProducts from "@/components/featured-products"
import Newsletter from "@/components/newsletter"
import { motion } from "framer-motion" // Import motion

export default function HomePage() {
  // Define animation variants for reusability
  const fadeInVariants = {
    initial: { opacity: 0, y: 50 },
    whileInView: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
  }

  const staggerContainerVariants = {
    initial: {},
    whileInView: {
      transition: {
        staggerChildren: 0.1, // Delay between children animations
      },
    },
  }

  const itemVariants = {
    initial: { opacity: 0, y: 50 },
    whileInView: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header is imported from layout.tsx */}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <motion.div
            className="mb-16"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainerVariants}
          >
            <div className="flex items-center gap-8 mb-12">
              <motion.h2 className="text-7xl md:text-8xl font-bold text-darkGreen leading-none" variants={itemVariants}>
                About
                <br />
                Prakriti
              </motion.h2>
              <div className="hidden md:block w-32 h-px bg-mocha ml-8"></div>
            </div>

            <div className="max-w-2xl ml-auto">
              <motion.p className="text-gray-600 text-lg leading-relaxed mb-6" variants={itemVariants}>
                "Fashion is the armor to survive the reality of everyday life", is the expression that resonates within
                every fashion enthusiast's heart. The exquisite designs, handcrafted garments, and cultural heritage
                celebrated at Prakriti become an inseparable part of your style and identity.
              </motion.p>
              <motion.div variants={itemVariants}>
                <Link href="/about" className="inline-flex items-center text-bronze hover:text-darkGreen font-medium">
                  Learn more
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Vision Card */}
          <motion.div
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInVariants}
          >
            <Card className="rounded-3xl overflow-hidden border-0 shadow-lg bg-beige">
              <CardContent className="p-0 relative">
                <div className="relative h-80 md:h-96">
                  <Image
                    src="/placeholder.svg?height=400&width=800"
                    alt="Traditional clothing and craftsmanship"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-darkGreen/30"></div>

                  {/* Vision Content */}
                  <div className="absolute top-8 left-8 max-w-md">
                    <h3 className="text-2xl font-bold text-cream mb-4">VISION</h3>
                    <p className="text-cream/90 text-sm leading-relaxed">
                      Fashion is meaningless if one is not able to express their identity through it and prosper as an
                      individual. To fill up the void, PRAKRITI aims to contribute to the fashion industry by supporting
                      emerging designers and highlighting traditional craftsmanship that is precious & valuable for our
                      cultural heritage.
                    </p>
                  </div>

                  {/* Mission Text on Right */}
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 transform rotate-90 origin-center">
                    <span className="text-cream/70 text-sm font-medium tracking-widest">MISSION</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Collections Preview */}
          <motion.section
            className="mt-20"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainerVariants}
          >
            <div className="grid md:grid-cols-4 gap-8">
              <motion.div variants={itemVariants}>
                <Link href="/collections/women">
                  <Card className="group cursor-pointer border-0 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative h-64">
                        <Image
                          src="/placeholder.svg?height=300&width=250"
                          alt="Women's Collection"
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-darkGreen/20 group-hover:bg-darkGreen/30 transition-colors"></div>
                        <div className="absolute bottom-6 left-6 text-cream">
                          <h4 className="text-xl font-semibold mb-2">Women</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-bronze text-cream bg-transparent hover:bg-cream hover:text-darkGreen"
                          >
                            Explore
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link href="/collections/men">
                  <Card className="group cursor-pointer border-0 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative h-64">
                        <Image
                          src="/placeholder.svg?height=300&width=250"
                          alt="Men's Collection"
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-darkGreen/20 group-hover:bg-darkGreen/30 transition-colors"></div>
                        <div className="absolute bottom-6 left-6 text-cream">
                          <h4 className="text-xl font-semibold mb-2">Men</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-bronze text-cream bg-transparent hover:bg-cream hover:text-darkGreen"
                          >
                            Explore
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link href="/collections/traditional">
                  <Card className="group cursor-pointer border-0 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative h-64">
                        <Image
                          src="/placeholder.svg?height=300&width=250"
                          alt="Traditional Wear"
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-darkGreen/20 group-hover:bg-darkGreen/30 transition-colors"></div>
                        <div className="absolute bottom-6 left-6 text-cream">
                          <h4 className="text-xl font-semibold mb-2">Traditional</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-bronze text-cream bg-transparent hover:bg-cream hover:text-darkGreen"
                          >
                            Explore
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link href="/collections/accessories">
                  <Card className="group cursor-pointer border-0 shadow-lg rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative h-64">
                        <Image
                          src="/placeholder.svg?height=300&width=250"
                          alt="Accessories"
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-darkGreen/20 group-hover:bg-darkGreen/30 transition-colors"></div>
                        <div className="absolute bottom-6 left-6 text-cream">
                          <h4 className="text-xl font-semibold mb-2">Accessories</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-bronze text-cream bg-transparent hover:bg-cream hover:text-darkGreen"
                          >
                            Explore
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            </div>
          </motion.section>

          {/* Featured Products */}
          <FeaturedProducts />

          {/* Newsletter */}
          <Newsletter />
        </div>
      </main>
    </div>
  )
}
